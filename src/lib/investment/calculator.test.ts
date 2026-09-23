import { describe, expect, it } from "vitest";
import {
  calculateInvestmentPortfolioYear,
  calculateInvestmentYear,
} from "./calculator";

function d(dateStr: string): Date {
  return new Date(dateStr);
}

describe("calculateInvestmentYear (移動平均法)", () => {
  it("買い増しのたびに平均取得単価を更新し、売却時の損益を計算する", () => {
    const result = calculateInvestmentYear("7203", [
      { tradedAt: d("2026-01-10"), type: "BUY", quantity: 100, unitPriceJpy: 2000 },
      { tradedAt: d("2026-03-05"), type: "BUY", quantity: 100, unitPriceJpy: 2400 },
      // 平均単価 = (100*2000 + 100*2400) / 200 = 2200
      { tradedAt: d("2026-06-01"), type: "SELL", quantity: 100, unitPriceJpy: 2600 },
    ]);

    expect(result.costOfSoldJpy.toNumber()).toBe(220_000);
    expect(result.proceedsJpy.toNumber()).toBe(260_000);
    expect(result.realizedGainJpy.toNumber()).toBe(40_000);
    expect(result.closingQuantity.toNumber()).toBe(100);
    expect(result.closingCostJpy.toNumber()).toBe(220_000);
  });

  it("取引を時系列順に処理する(入力順が前後していても結果は同じ)", () => {
    const trades = [
      { tradedAt: d("2026-06-01"), type: "SELL" as const, quantity: 100, unitPriceJpy: 2600 },
      { tradedAt: d("2026-01-10"), type: "BUY" as const, quantity: 100, unitPriceJpy: 2000 },
      { tradedAt: d("2026-03-05"), type: "BUY" as const, quantity: 100, unitPriceJpy: 2400 },
    ];
    const result = calculateInvestmentYear("7203", trades);
    expect(result.realizedGainJpy.toNumber()).toBe(40_000);
  });

  it("期首保有分を平均単価計算に合算する", () => {
    const result = calculateInvestmentYear(
      "7203",
      [{ tradedAt: d("2026-04-01"), type: "SELL", quantity: 50, unitPriceJpy: 3000 }],
      { quantity: 100, costBasisJpy: 200_000 }, // 平均2000円
    );

    expect(result.costOfSoldJpy.toNumber()).toBe(100_000);
    expect(result.realizedGainJpy.toNumber()).toBe(50_000);
    expect(result.closingQuantity.toNumber()).toBe(50);
  });

  it("手数料は取得費に加算・譲渡収入から控除する", () => {
    const result = calculateInvestmentYear("7203", [
      { tradedAt: d("2026-01-10"), type: "BUY", quantity: 100, unitPriceJpy: 2000, feeJpy: 500 },
      { tradedAt: d("2026-06-01"), type: "SELL", quantity: 100, unitPriceJpy: 2500, feeJpy: 300 },
    ]);

    expect(result.costOfSoldJpy.toNumber()).toBe(200_500);
    expect(result.proceedsJpy.toNumber()).toBe(249_700);
    expect(result.realizedGainJpy.toNumber()).toBe(49_200);
  });

  it("配当は損益計算に含めず別集計する", () => {
    const result = calculateInvestmentYear("7203", [
      { tradedAt: d("2026-01-10"), type: "BUY", quantity: 100, unitPriceJpy: 2000 },
      { tradedAt: d("2026-03-01"), type: "DIVIDEND", quantity: 1, unitPriceJpy: 15_000 },
    ]);

    expect(result.dividendJpy.toNumber()).toBe(15_000);
    expect(result.realizedGainJpy.toNumber()).toBe(0);
    expect(result.closingQuantity.toNumber()).toBe(100);
  });

  it("国外源泉の配当は外国所得税額とあわせて別集計される", () => {
    const result = calculateInvestmentYear("VOO", [
      { tradedAt: d("2026-01-10"), type: "BUY", quantity: 10, unitPriceJpy: 50_000 },
      {
        tradedAt: d("2026-03-01"),
        type: "DIVIDEND",
        quantity: 1,
        unitPriceJpy: 10_000,
        isForeign: true,
        foreignTaxWithheldJpy: 1000,
      },
      { tradedAt: d("2026-06-01"), type: "DIVIDEND", quantity: 1, unitPriceJpy: 5000 },
    ]);

    expect(result.dividendJpy.toNumber()).toBe(15_000);
    expect(result.foreignSourceDividendJpy.toNumber()).toBe(10_000);
    expect(result.foreignTaxWithheldJpy.toNumber()).toBe(1000);
  });

  it("配当は銘柄種別ごとに配当控除の税率区分を集計する", () => {
    const result = calculateInvestmentYear("MIXED", [
      // STOCK(既定値・assetType省略): 通常税率
      { tradedAt: d("2026-01-10"), type: "DIVIDEND", quantity: 1, unitPriceJpy: 10_000 },
      // ETF: 通常税率
      {
        tradedAt: d("2026-02-10"),
        type: "DIVIDEND",
        quantity: 1,
        unitPriceJpy: 5000,
        assetType: "ETF",
      },
      // MUTUAL_FUND: 半分税率
      {
        tradedAt: d("2026-03-10"),
        type: "DIVIDEND",
        quantity: 1,
        unitPriceJpy: 3000,
        assetType: "MUTUAL_FUND",
      },
      // BOND: 対象外
      {
        tradedAt: d("2026-04-10"),
        type: "DIVIDEND",
        quantity: 1,
        unitPriceJpy: 2000,
        assetType: "BOND",
      },
      // OTHER: 対象外
      {
        tradedAt: d("2026-05-10"),
        type: "DIVIDEND",
        quantity: 1,
        unitPriceJpy: 1000,
        assetType: "OTHER",
      },
    ]);

    expect(result.dividendJpy.toNumber()).toBe(21_000);
    expect(result.dividendFullCreditJpy.toNumber()).toBe(15_000);
    expect(result.dividendHalfCreditJpy.toNumber()).toBe(3000);
    expect(result.dividendNoCreditJpy.toNumber()).toBe(3000);
  });

  it("J-REIT型ETF(isReit=true)の分配金は配当控除の対象外として集計する", () => {
    const result = calculateInvestmentYear("MIXED", [
      // 通常のETF: 通常税率
      {
        tradedAt: d("2026-01-10"),
        type: "DIVIDEND",
        quantity: 1,
        unitPriceJpy: 5000,
        assetType: "ETF",
      },
      // J-REIT型ETF: 配当控除の対象外
      {
        tradedAt: d("2026-02-10"),
        type: "DIVIDEND",
        quantity: 1,
        unitPriceJpy: 8000,
        assetType: "ETF",
        isReit: true,
      },
      // isReit=trueでもETF以外(例: STOCK)には影響しない
      {
        tradedAt: d("2026-03-10"),
        type: "DIVIDEND",
        quantity: 1,
        unitPriceJpy: 2000,
        assetType: "STOCK",
        isReit: true,
      },
    ]);

    expect(result.dividendJpy.toNumber()).toBe(15_000);
    expect(result.dividendFullCreditJpy.toNumber()).toBe(7000);
    expect(result.dividendNoCreditJpy.toNumber()).toBe(8000);
  });

  it("国外源泉株式等の譲渡益は外国税額控除の国外所得金額として別集計される(為替差損益を含む)", () => {
    const result = calculateInvestmentYear("VOO", [
      { tradedAt: d("2026-01-10"), type: "BUY", quantity: 10, unitPriceJpy: 50_000, isForeign: true },
      {
        tradedAt: d("2026-06-01"),
        type: "SELL",
        quantity: 10,
        unitPriceJpy: 60_000,
        isForeign: true,
      },
      { tradedAt: d("2026-07-01"), type: "BUY", quantity: 100, unitPriceJpy: 2000 },
      { tradedAt: d("2026-08-01"), type: "SELL", quantity: 100, unitPriceJpy: 2500 },
    ]);

    // 国外源泉分の譲渡益(60,000-50,000)*10 = 100,000のみが集計され、
    // 国内株式(9984ではなく同一結果内の別ロット)の譲渡益は含まれない
    expect(result.realizedGainJpy.toNumber()).toBe(100_000 + 50_000);
    expect(result.foreignSourceCapitalGainJpy.toNumber()).toBe(100_000);
  });

  it("NISA口座の国外源泉株式等の譲渡益は非課税のため外国税額控除の自動集計対象にならない", () => {
    const result = calculateInvestmentYear("VOO", [
      { tradedAt: d("2026-01-10"), type: "BUY", quantity: 10, unitPriceJpy: 50_000, isNisa: true, isForeign: true },
      {
        tradedAt: d("2026-06-01"),
        type: "SELL",
        quantity: 10,
        unitPriceJpy: 60_000,
        isNisa: true,
        isForeign: true,
      },
    ]);

    expect(result.nisaRealizedGainJpy.toNumber()).toBe(100_000);
    expect(result.foreignSourceCapitalGainJpy.toNumber()).toBe(0);
  });

  it("NISA口座の国外源泉配当は非課税のため外国税額控除の自動集計対象にならない", () => {
    const result = calculateInvestmentYear("VOO", [
      {
        tradedAt: d("2026-03-01"),
        type: "DIVIDEND",
        quantity: 1,
        unitPriceJpy: 10_000,
        isNisa: true,
        isForeign: true,
        foreignTaxWithheldJpy: 1000,
      },
    ]);

    expect(result.nisaDividendJpy.toNumber()).toBe(10_000);
    expect(result.foreignSourceDividendJpy.toNumber()).toBe(0);
    expect(result.foreignTaxWithheldJpy.toNumber()).toBe(0);
  });

  it("NISA口座の取引は課税口座と分離され、非課税枠として別集計される", () => {
    const result = calculateInvestmentYear("7203", [
      { tradedAt: d("2026-01-10"), type: "BUY", quantity: 100, unitPriceJpy: 2000, isNisa: true },
      { tradedAt: d("2026-06-01"), type: "SELL", quantity: 100, unitPriceJpy: 3000, isNisa: true },
      { tradedAt: d("2026-02-01"), type: "BUY", quantity: 10, unitPriceJpy: 2000 },
    ]);

    expect(result.nisaRealizedGainJpy.toNumber()).toBe(100_000);
    expect(result.realizedGainJpy.toNumber()).toBe(0);
    expect(result.closingQuantity.toNumber()).toBe(10);
  });

  it("保有数量を超える売却はエラーになる", () => {
    expect(() =>
      calculateInvestmentYear("7203", [
        { tradedAt: d("2026-01-01"), type: "SELL", quantity: 1, unitPriceJpy: 100 },
      ]),
    ).toThrow();
  });
});

describe("calculateInvestmentPortfolioYear", () => {
  it("複数銘柄の損益・配当を合算する", () => {
    const result = calculateInvestmentPortfolioYear([
      { symbol: "7203", tradedAt: d("2026-01-01"), type: "BUY", quantity: 100, unitPriceJpy: 2000 },
      { symbol: "7203", tradedAt: d("2026-06-01"), type: "SELL", quantity: 100, unitPriceJpy: 2500 },
      { symbol: "9984", tradedAt: d("2026-01-01"), type: "BUY", quantity: 10, unitPriceJpy: 6000 },
      { symbol: "9984", tradedAt: d("2026-06-01"), type: "SELL", quantity: 10, unitPriceJpy: 5000 },
      { symbol: "9984", tradedAt: d("2026-03-01"), type: "DIVIDEND", quantity: 1, unitPriceJpy: 3000 },
    ]);

    expect(result.totalRealizedGainJpy.toNumber()).toBe(50_000 - 10_000);
    expect(result.totalDividendJpy.toNumber()).toBe(3000);
    expect(result.bySymbol).toHaveLength(2);
  });

  it("複数銘柄の配当を配当控除の税率区分ごとに合算する", () => {
    const result = calculateInvestmentPortfolioYear([
      { symbol: "7203", tradedAt: d("2026-01-01"), type: "DIVIDEND", quantity: 1, unitPriceJpy: 10_000 },
      {
        symbol: "2559",
        tradedAt: d("2026-02-01"),
        type: "DIVIDEND",
        quantity: 1,
        unitPriceJpy: 6000,
        assetType: "MUTUAL_FUND",
      },
      {
        symbol: "2510",
        tradedAt: d("2026-03-01"),
        type: "DIVIDEND",
        quantity: 1,
        unitPriceJpy: 4000,
        assetType: "BOND",
      },
    ]);

    expect(result.totalDividendJpy.toNumber()).toBe(20_000);
    expect(result.totalDividendFullCreditJpy.toNumber()).toBe(10_000);
    expect(result.totalDividendHalfCreditJpy.toNumber()).toBe(6000);
    expect(result.totalDividendNoCreditJpy.toNumber()).toBe(4000);
  });

  it("複数銘柄の国外源泉配当・外国所得税額を合算する", () => {
    const result = calculateInvestmentPortfolioYear([
      {
        symbol: "VOO",
        tradedAt: d("2026-03-01"),
        type: "DIVIDEND",
        quantity: 1,
        unitPriceJpy: 10_000,
        isForeign: true,
        foreignTaxWithheldJpy: 1000,
      },
      {
        symbol: "VT",
        tradedAt: d("2026-06-01"),
        type: "DIVIDEND",
        quantity: 1,
        unitPriceJpy: 5000,
        isForeign: true,
        foreignTaxWithheldJpy: 500,
      },
      { symbol: "7203", tradedAt: d("2026-06-01"), type: "DIVIDEND", quantity: 1, unitPriceJpy: 3000 },
    ]);

    expect(result.totalForeignSourceDividendJpy.toNumber()).toBe(15_000);
    expect(result.totalForeignTaxWithheldJpy.toNumber()).toBe(1500);
    expect(result.totalDividendJpy.toNumber()).toBe(18_000);
  });

  it("国外源泉の配当と譲渡益を合算した金額が国外所得金額の自動集計値になる", () => {
    const result = calculateInvestmentPortfolioYear([
      {
        symbol: "VOO",
        tradedAt: d("2026-01-10"),
        type: "BUY",
        quantity: 10,
        unitPriceJpy: 50_000,
        isForeign: true,
      },
      {
        symbol: "VOO",
        tradedAt: d("2026-06-01"),
        type: "SELL",
        quantity: 10,
        unitPriceJpy: 60_000,
        isForeign: true,
      },
      {
        symbol: "VOO",
        tradedAt: d("2026-03-01"),
        type: "DIVIDEND",
        quantity: 1,
        unitPriceJpy: 10_000,
        isForeign: true,
        foreignTaxWithheldJpy: 1000,
      },
    ]);

    expect(result.totalForeignSourceCapitalGainJpy.toNumber()).toBe(100_000);
    expect(result.totalForeignSourceDividendJpy.toNumber()).toBe(10_000);
    expect(result.totalForeignSourceIncomeJpy.toNumber()).toBe(110_000);
  });
});
