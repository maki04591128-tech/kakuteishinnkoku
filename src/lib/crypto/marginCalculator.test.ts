import { describe, expect, it } from "vitest";
import {
  calculateCryptoMarginPortfolioYear,
  calculateCryptoMarginYear,
} from "./marginCalculator";

describe("calculateCryptoMarginYear", () => {
  it("決済損益をそのまま合算する(取得原価の概念がない)", () => {
    const result = calculateCryptoMarginYear("BTC", [
      { realizedPnlJpy: 100_000 },
      { realizedPnlJpy: -30_000 },
    ]);

    expect(result.settlementCount).toBe(2);
    expect(result.grossPnlJpy.toNumber()).toBe(70_000);
    expect(result.realizedGainJpy.toNumber()).toBe(70_000);
  });

  it("手数料を控除し、スワップポイントを加算する", () => {
    const result = calculateCryptoMarginYear("BTC", [
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
    const result = calculateCryptoMarginYear("ETH", [
      { realizedPnlJpy: -80_000, feeJpy: 2_000 },
    ]);

    expect(result.realizedGainJpy.toNumber()).toBe(-82_000);
  });

  it("負の手数料はエラーになる", () => {
    expect(() =>
      calculateCryptoMarginYear("BTC", [{ realizedPnlJpy: 1000, feeJpy: -1 }]),
    ).toThrow();
  });

  it("取引が無い場合は全て0になる", () => {
    const result = calculateCryptoMarginYear("BTC", []);
    expect(result.settlementCount).toBe(0);
    expect(result.realizedGainJpy.toNumber()).toBe(0);
  });
});

describe("calculateCryptoMarginPortfolioYear", () => {
  it("銘柄別に集計し、全体の合計も算出する", () => {
    const result = calculateCryptoMarginPortfolioYear([
      { symbol: "ETH", realizedPnlJpy: 10_000 },
      { symbol: "BTC", realizedPnlJpy: 100_000, feeJpy: 1_000 },
      { symbol: "BTC", realizedPnlJpy: -20_000 },
    ]);

    expect(result.bySymbol.map((r) => r.symbol)).toEqual(["BTC", "ETH"]);
    const btc = result.bySymbol.find((r) => r.symbol === "BTC")!;
    expect(btc.settlementCount).toBe(2);
    expect(btc.realizedGainJpy.toNumber()).toBe(79_000);
    expect(result.totalRealizedGainJpy.toNumber()).toBe(89_000);
  });

  it("取引が無い場合は空配列・合計0になる", () => {
    const result = calculateCryptoMarginPortfolioYear([]);
    expect(result.bySymbol).toEqual([]);
    expect(result.totalRealizedGainJpy.toNumber()).toBe(0);
  });
});
