import { describe, expect, it } from "vitest";
import { estimateExchangeCompensationIncome } from "./exchangeCompensationIncome";

describe("estimateExchangeCompensationIncome", () => {
  it("補償金額が取得費を上回る場合は雑所得(プラス)になる", () => {
    const result = estimateExchangeCompensationIncome([
      { symbol: "BTC", compensationAmountJpy: 800_000, acquisitionCostJpy: 500_000 },
    ]);
    expect(result.totalCompensationAmountJpy.toNumber()).toBe(800_000);
    expect(result.totalAcquisitionCostJpy.toNumber()).toBe(500_000);
    expect(result.totalGainOrLossJpy.toNumber()).toBe(300_000);
    expect(result.bySymbol).toHaveLength(1);
    expect(result.bySymbol[0].gainOrLossJpy.toNumber()).toBe(300_000);
  });

  it("補償金額が取得費を下回る場合は損失(マイナス)になり他の雑所得と通算できる", () => {
    const result = estimateExchangeCompensationIncome([
      { symbol: "ETH", compensationAmountJpy: 200_000, acquisitionCostJpy: 500_000 },
    ]);
    expect(result.totalGainOrLossJpy.toNumber()).toBe(-300_000);
  });

  it("同一銘柄の複数の補償イベントは合算される", () => {
    const result = estimateExchangeCompensationIncome([
      { symbol: "BTC", compensationAmountJpy: 500_000, acquisitionCostJpy: 300_000 },
      { symbol: "BTC", compensationAmountJpy: 300_000, acquisitionCostJpy: 400_000 },
    ]);
    expect(result.bySymbol).toHaveLength(1);
    expect(result.bySymbol[0].eventCount).toBe(2);
    expect(result.bySymbol[0].compensationAmountJpy.toNumber()).toBe(800_000);
    expect(result.bySymbol[0].acquisitionCostJpy.toNumber()).toBe(700_000);
    expect(result.bySymbol[0].gainOrLossJpy.toNumber()).toBe(100_000);
  });

  it("銘柄ごとの内訳と合計を正しく計算する", () => {
    const result = estimateExchangeCompensationIncome([
      { symbol: "BTC", compensationAmountJpy: 800_000, acquisitionCostJpy: 500_000 },
      { symbol: "ETH", compensationAmountJpy: 200_000, acquisitionCostJpy: 500_000 },
    ]);
    expect(result.bySymbol.map((r) => r.symbol)).toEqual(["BTC", "ETH"]);
    expect(result.totalCompensationAmountJpy.toNumber()).toBe(1_000_000);
    expect(result.totalAcquisitionCostJpy.toNumber()).toBe(1_000_000);
    expect(result.totalGainOrLossJpy.toNumber()).toBe(0);
  });

  it("入力が空の場合は合計0を返す", () => {
    const result = estimateExchangeCompensationIncome([]);
    expect(result.bySymbol).toHaveLength(0);
    expect(result.totalGainOrLossJpy.toNumber()).toBe(0);
  });

  it("銘柄シンボルが空の場合はエラーを投げる", () => {
    expect(() =>
      estimateExchangeCompensationIncome([
        { symbol: "  ", compensationAmountJpy: 100_000, acquisitionCostJpy: 100_000 },
      ]),
    ).toThrow();
  });

  it("マイナスの補償金額はエラーを投げる", () => {
    expect(() =>
      estimateExchangeCompensationIncome([
        { symbol: "BTC", compensationAmountJpy: -1, acquisitionCostJpy: 100_000 },
      ]),
    ).toThrow();
  });

  it("マイナスの取得費はエラーを投げる", () => {
    expect(() =>
      estimateExchangeCompensationIncome([
        { symbol: "BTC", compensationAmountJpy: 100_000, acquisitionCostJpy: -1 },
      ]),
    ).toThrow();
  });
});
