import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  calculateForeignCurrencyDepositPortfolioYear,
  calculateForeignCurrencyDepositYear,
} from "./foreignCurrencyDeposit";

describe("calculateForeignCurrencyDepositYear (総平均法に準ずる方法)", () => {
  it("国税庁質疑応答事例の設例(貸付用建物の購入)と一致する", () => {
    // 預金A: 10万ドルを1ドル=100円で預入、預金B: 5万ドルを1ドル=112円で預入。
    // 合計15万ドルのうち12万ドルを1ドル=120円相当の建物購入に充当(=払出)、
    // 残り3万ドルはそのまま保有。
    const result = calculateForeignCurrencyDepositYear("USD", [
      { type: "DEPOSIT", amount: 100_000, exchangeRateJpy: 100 },
      { type: "DEPOSIT", amount: 50_000, exchangeRateJpy: 112 },
      { type: "WITHDRAWAL", amount: 120_000, exchangeRateJpy: 120 },
    ]);

    // 平均レート = (10,000,000 + 5,600,000) / 150,000 = 104円
    expect(result.averageRateJpy.toNumber()).toBe(104);
    // 為替差益 = (120円-104円) × 12万ドル = 1,920,000円
    expect(result.realizedGainJpy.toNumber()).toBe(1_920_000);
    expect(result.closingAmount.toNumber()).toBe(30_000);
    expect(result.closingCostJpy.toNumber()).toBe(30_000 * 104);
  });

  it("払出時のレートが預入時より円安なら為替差益、円高なら為替差損になる", () => {
    const gain = calculateForeignCurrencyDepositYear("USD", [
      { type: "DEPOSIT", amount: 10_000, exchangeRateJpy: 100 },
      { type: "WITHDRAWAL", amount: 10_000, exchangeRateJpy: 110 },
    ]);
    expect(gain.realizedGainJpy.toNumber()).toBe(100_000);

    const loss = calculateForeignCurrencyDepositYear("USD", [
      { type: "DEPOSIT", amount: 10_000, exchangeRateJpy: 110 },
      { type: "WITHDRAWAL", amount: 10_000, exchangeRateJpy: 100 },
    ]);
    expect(loss.realizedGainJpy.toNumber()).toBe(-100_000);
  });

  it("期首残高を翌年へ正しく繰り越せる", () => {
    const result = calculateForeignCurrencyDepositYear(
      "EUR",
      [{ type: "WITHDRAWAL", amount: 1_000, exchangeRateJpy: 160 }],
      { amount: 2_000, costBasisJpy: 280_000 }, // 単価140円で2,000EUR保有
    );

    expect(result.averageRateJpy.toNumber()).toBe(140);
    expect(result.realizedGainJpy.toNumber()).toBe((160 - 140) * 1_000);
    expect(result.closingAmount.toNumber()).toBe(1_000);
    expect(result.closingCostJpy.toNumber()).toBe(140_000);
  });

  it("預入のみで払出が無い場合は為替差損益が生じない", () => {
    const result = calculateForeignCurrencyDepositYear("USD", [
      { type: "DEPOSIT", amount: 1_000, exchangeRateJpy: 150 },
    ]);
    expect(result.realizedGainJpy.toNumber()).toBe(0);
    expect(result.closingAmount.toNumber()).toBe(1_000);
    expect(result.closingCostJpy.toNumber()).toBe(150_000);
  });

  it("期首残高+年間預入数量を超える払出はエラーになる", () => {
    expect(() =>
      calculateForeignCurrencyDepositYear("USD", [
        { type: "DEPOSIT", amount: 1_000, exchangeRateJpy: 150 },
        { type: "WITHDRAWAL", amount: 2_000, exchangeRateJpy: 150 },
      ]),
    ).toThrow();
  });

  it("数量が0以下、又は円換算レートが負の場合はエラーになる", () => {
    expect(() =>
      calculateForeignCurrencyDepositYear("USD", [
        { type: "DEPOSIT", amount: 0, exchangeRateJpy: 150 },
      ]),
    ).toThrow();
    expect(() =>
      calculateForeignCurrencyDepositYear("USD", [
        { type: "DEPOSIT", amount: 1_000, exchangeRateJpy: -1 },
      ]),
    ).toThrow();
  });
});

describe("calculateForeignCurrencyDepositPortfolioYear", () => {
  it("通貨ごとに集計し、全通貨合計の雑所得を求める", () => {
    const result = calculateForeignCurrencyDepositPortfolioYear([
      { currency: "USD", type: "DEPOSIT", amount: 10_000, exchangeRateJpy: 100 },
      { currency: "USD", type: "WITHDRAWAL", amount: 10_000, exchangeRateJpy: 110 },
      { currency: "EUR", type: "DEPOSIT", amount: 5_000, exchangeRateJpy: 160 },
      { currency: "EUR", type: "WITHDRAWAL", amount: 5_000, exchangeRateJpy: 150 },
    ]);

    expect(result.byCurrency.map((r) => r.currency)).toEqual(["EUR", "USD"]);
    const usd = result.byCurrency.find((r) => r.currency === "USD");
    const eur = result.byCurrency.find((r) => r.currency === "EUR");
    expect(usd?.realizedGainJpy.toNumber()).toBe(100_000);
    expect(eur?.realizedGainJpy.toNumber()).toBe(-50_000);
    expect(result.totalRealizedGainJpy.toNumber()).toBe(50_000);
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it("期首残高のみ存在し当年イベントが無い通貨も結果に含める", () => {
    const result = calculateForeignCurrencyDepositPortfolioYear([], {
      GBP: { amount: 1_000, costBasisJpy: 190_000 },
    });
    expect(result.byCurrency).toHaveLength(1);
    expect(result.byCurrency[0].currency).toBe("GBP");
    expect(result.byCurrency[0].closingAmount.toNumber()).toBe(1_000);
    expect(result.totalRealizedGainJpy.toNumber()).toBe(0);
  });

  it("Decimal.Value形式の入力でも計算できる", () => {
    const result = calculateForeignCurrencyDepositPortfolioYear([
      { currency: "USD", type: "DEPOSIT", amount: new Decimal(1_000), exchangeRateJpy: "150.5" },
    ]);
    expect(result.byCurrency[0].depositedCostJpy.toNumber()).toBe(150_500);
  });
});
