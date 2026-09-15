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
});
