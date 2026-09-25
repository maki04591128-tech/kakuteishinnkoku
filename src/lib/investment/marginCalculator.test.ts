import { describe, expect, it } from "vitest";
import {
  calculateStockMarginPortfolioYear,
  calculateStockMarginYear,
} from "./marginCalculator";

describe("calculateStockMarginYear", () => {
  it("決済損益をそのまま合算する(取得原価の概念がない)", () => {
    const result = calculateStockMarginYear("7203", [
      { realizedPnlJpy: 100_000 },
      { realizedPnlJpy: -30_000 },
    ]);

    expect(result.settlementCount).toBe(2);
    expect(result.grossPnlJpy.toNumber()).toBe(70_000);
    expect(result.realizedGainJpy.toNumber()).toBe(70_000);
  });

  it("手数料を控除し、金利相当額・品貸料・配当落調整額の純額調整を加算する", () => {
    const result = calculateStockMarginYear("7203", [
      { realizedPnlJpy: 200_000, feeJpy: 1_000, interestAdjustmentJpy: -500 },
      { realizedPnlJpy: -50_000, feeJpy: 500, interestAdjustmentJpy: 200 },
    ]);

    expect(result.grossPnlJpy.toNumber()).toBe(150_000);
    expect(result.feeJpy.toNumber()).toBe(1_500);
    expect(result.interestAdjustmentJpy.toNumber()).toBe(-300);
    // 150,000 - 1,500 + (-300) = 148,200
    expect(result.realizedGainJpy.toNumber()).toBe(148_200);
  });

  it("損失のみの年は譲渡所得算入額がマイナスになる", () => {
    const result = calculateStockMarginYear("9984", [
      { realizedPnlJpy: -80_000, feeJpy: 2_000 },
    ]);

    expect(result.realizedGainJpy.toNumber()).toBe(-82_000);
  });

  it("負の手数料はエラーになる", () => {
    expect(() =>
      calculateStockMarginYear("7203", [{ realizedPnlJpy: 1000, feeJpy: -1 }]),
    ).toThrow();
  });

  it("取引が無い場合は全て0になる", () => {
    const result = calculateStockMarginYear("7203", []);
    expect(result.settlementCount).toBe(0);
    expect(result.realizedGainJpy.toNumber()).toBe(0);
  });
});

describe("calculateStockMarginPortfolioYear", () => {
  it("銘柄別に集計し、全体の合計も算出する", () => {
    const result = calculateStockMarginPortfolioYear([
      { symbol: "9984", realizedPnlJpy: 10_000 },
      { symbol: "7203", realizedPnlJpy: 100_000, feeJpy: 1_000 },
      { symbol: "7203", realizedPnlJpy: -20_000 },
    ]);

    expect(result.bySymbol.map((r) => r.symbol)).toEqual(["7203", "9984"]);
    const toyota = result.bySymbol.find((r) => r.symbol === "7203")!;
    expect(toyota.settlementCount).toBe(2);
    expect(toyota.realizedGainJpy.toNumber()).toBe(79_000);
    expect(result.totalRealizedGainJpy.toNumber()).toBe(89_000);
  });

  it("取引が無い場合は空配列・合計0になる", () => {
    const result = calculateStockMarginPortfolioYear([]);
    expect(result.bySymbol).toEqual([]);
    expect(result.totalRealizedGainJpy.toNumber()).toBe(0);
  });
});
