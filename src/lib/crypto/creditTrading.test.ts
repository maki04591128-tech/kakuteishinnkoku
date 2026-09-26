import { describe, expect, it } from "vitest";
import {
  calculateCryptoCreditPortfolioYear,
  calculateCryptoCreditYear,
} from "./creditTrading";

describe("calculateCryptoCreditYear", () => {
  it("決済損益をそのまま合算する(取得原価の概念がない)", () => {
    const result = calculateCryptoCreditYear("BTC", [
      { realizedPnlJpy: 200_000 },
      { realizedPnlJpy: -50_000 },
    ]);

    expect(result.settlementCount).toBe(2);
    expect(result.grossPnlJpy.toNumber()).toBe(150_000);
    expect(result.realizedGainJpy.toNumber()).toBe(150_000);
  });

  it("FAQ2-13の設例どおり、売付け価額と買付け価額の差額を所得金額として計算する", () => {
    // 9/1 1BTCを1,000,000円で売り付け、9/24 1BTCを800,000円で買い付けて決済
    const result = calculateCryptoCreditYear("BTC", [
      { realizedPnlJpy: 1_000_000 - 800_000 },
    ]);

    expect(result.realizedGainJpy.toNumber()).toBe(200_000);
  });

  it("手数料を控除し、金利相当額・品貸料の純額調整を加算する", () => {
    const result = calculateCryptoCreditYear("BTC", [
      { realizedPnlJpy: 200_000, feeJpy: 1_000, interestAdjustmentJpy: -500 },
      { realizedPnlJpy: -50_000, feeJpy: 500, interestAdjustmentJpy: 200 },
    ]);

    expect(result.grossPnlJpy.toNumber()).toBe(150_000);
    expect(result.feeJpy.toNumber()).toBe(1_500);
    expect(result.interestAdjustmentJpy.toNumber()).toBe(-300);
    // 150,000 - 1,500 + (-300) = 148,200
    expect(result.realizedGainJpy.toNumber()).toBe(148_200);
  });

  it("損失のみの年は雑所得算入額がマイナスになる", () => {
    const result = calculateCryptoCreditYear("ETH", [
      { realizedPnlJpy: -80_000, feeJpy: 2_000 },
    ]);

    expect(result.realizedGainJpy.toNumber()).toBe(-82_000);
  });

  it("負の手数料はエラーになる", () => {
    expect(() =>
      calculateCryptoCreditYear("BTC", [{ realizedPnlJpy: 1000, feeJpy: -1 }]),
    ).toThrow();
  });

  it("取引が無い場合は全て0になる", () => {
    const result = calculateCryptoCreditYear("BTC", []);
    expect(result.settlementCount).toBe(0);
    expect(result.realizedGainJpy.toNumber()).toBe(0);
  });
});

describe("calculateCryptoCreditPortfolioYear", () => {
  it("銘柄別に集計し、全体の合計も算出する", () => {
    const result = calculateCryptoCreditPortfolioYear([
      { symbol: "ETH", realizedPnlJpy: 10_000 },
      { symbol: "BTC", realizedPnlJpy: 200_000, feeJpy: 1_000 },
      { symbol: "BTC", realizedPnlJpy: -20_000 },
    ]);

    expect(result.bySymbol.map((r) => r.symbol)).toEqual(["BTC", "ETH"]);
    const btc = result.bySymbol.find((r) => r.symbol === "BTC")!;
    expect(btc.settlementCount).toBe(2);
    expect(btc.realizedGainJpy.toNumber()).toBe(179_000);
    expect(result.totalRealizedGainJpy.toNumber()).toBe(189_000);
  });

  it("取引が無い場合は空配列・合計0になる", () => {
    const result = calculateCryptoCreditPortfolioYear([]);
    expect(result.bySymbol).toEqual([]);
    expect(result.totalRealizedGainJpy.toNumber()).toBe(0);
  });
});
