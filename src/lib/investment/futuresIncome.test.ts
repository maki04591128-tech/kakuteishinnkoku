import { describe, expect, it } from "vitest";
import {
  calculateFuturesPortfolioYear,
  calculateFuturesYear,
} from "./futuresIncome";

describe("calculateFuturesYear", () => {
  it("決済損益をそのまま合算する(取得原価の概念がない)", () => {
    const result = calculateFuturesYear("USD/JPY", [
      { realizedPnlJpy: 100_000 },
      { realizedPnlJpy: -30_000 },
    ]);

    expect(result.settlementCount).toBe(2);
    expect(result.grossPnlJpy.toNumber()).toBe(70_000);
    expect(result.realizedGainJpy.toNumber()).toBe(70_000);
  });

  it("手数料を控除し、スワップポイントを加算する", () => {
    const result = calculateFuturesYear("USD/JPY", [
      { realizedPnlJpy: 200_000, feeJpy: 1_000, swapJpy: -500 },
      { realizedPnlJpy: -50_000, feeJpy: 500, swapJpy: 200 },
    ]);

    expect(result.grossPnlJpy.toNumber()).toBe(150_000);
    expect(result.feeJpy.toNumber()).toBe(1_500);
    expect(result.swapJpy.toNumber()).toBe(-300);
    // 150,000 - 1,500 + (-300) = 148,200
    expect(result.realizedGainJpy.toNumber()).toBe(148_200);
  });

  it("損失のみの年は雑所得算入額がマイナスになる", () => {
    const result = calculateFuturesYear("日経225先物", [
      { realizedPnlJpy: -80_000, feeJpy: 2_000 },
    ]);

    expect(result.realizedGainJpy.toNumber()).toBe(-82_000);
  });

  it("負の手数料はエラーになる", () => {
    expect(() =>
      calculateFuturesYear("USD/JPY", [{ realizedPnlJpy: 1000, feeJpy: -1 }]),
    ).toThrow();
  });

  it("取引が無い場合は全て0になる", () => {
    const result = calculateFuturesYear("USD/JPY", []);
    expect(result.settlementCount).toBe(0);
    expect(result.realizedGainJpy.toNumber()).toBe(0);
  });
});

describe("calculateFuturesPortfolioYear", () => {
  it("銘柄別に集計し、全体の合計も算出する", () => {
    const result = calculateFuturesPortfolioYear([
      { symbol: "EUR/JPY", realizedPnlJpy: 10_000 },
      { symbol: "USD/JPY", realizedPnlJpy: 100_000, feeJpy: 1_000 },
      { symbol: "USD/JPY", realizedPnlJpy: -20_000 },
    ]);

    expect(result.bySymbol.map((r) => r.symbol)).toEqual(["EUR/JPY", "USD/JPY"]);
    const usdJpy = result.bySymbol.find((r) => r.symbol === "USD/JPY")!;
    expect(usdJpy.settlementCount).toBe(2);
    expect(usdJpy.realizedGainJpy.toNumber()).toBe(79_000);
    expect(result.totalRealizedGainJpy.toNumber()).toBe(89_000);
  });

  it("取引が無い場合は空配列・合計0になる", () => {
    const result = calculateFuturesPortfolioYear([]);
    expect(result.bySymbol).toEqual([]);
    expect(result.totalRealizedGainJpy.toNumber()).toBe(0);
  });
});
