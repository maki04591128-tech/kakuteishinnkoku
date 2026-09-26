import { describe, expect, it } from "vitest";
import { estimateAngelTaxCapitalGainDeduction } from "./angelTaxCapitalGainDeduction";

describe("estimateAngelTaxCapitalGainDeduction", () => {
  it("年末まで保有し続けた場合、払込取得価額の全額を控除対象にする", () => {
    const result = estimateAngelTaxCapitalGainDeduction({
      stocks: [{ symbol: "A社", acquiredQuantity: 100, acquiredCostJpy: 3_000_000 }],
      generalStockCapitalGainJpy: 0,
      listedStockCapitalGainJpy: 5_000_000,
    });

    expect(result.stocks[0].averageUnitCostJpy.toNumber()).toBe(30_000);
    expect(result.stocks[0].heldQuantity.toNumber()).toBe(100);
    expect(result.totalDeductionBeforeLimitJpy.toNumber()).toBe(3_000_000);
    expect(result.usedAgainstListedStockJpy.toNumber()).toBe(3_000_000);
    expect(result.totalUsedJpy.toNumber()).toBe(3_000_000);
    expect(result.unusedJpy.toNumber()).toBe(0);
    expect(result.listedStockCapitalGainAfterDeductionJpy.toNumber()).toBe(2_000_000);
  });

  it("年中に一部を譲渡した場合、その部分の取得価額は控除対象から除く", () => {
    const result = estimateAngelTaxCapitalGainDeduction({
      stocks: [
        {
          symbol: "A社",
          acquiredQuantity: 100,
          acquiredCostJpy: 3_000_000,
          disposedQuantitySameYear: 40,
        },
      ],
      generalStockCapitalGainJpy: 0,
      listedStockCapitalGainJpy: 5_000_000,
    });

    // 平均単価30,000円 × 保有60株 = 1,800,000円のみ控除対象
    expect(result.stocks[0].heldQuantity.toNumber()).toBe(60);
    expect(result.totalDeductionBeforeLimitJpy.toNumber()).toBe(1_800_000);
    expect(result.totalUsedJpy.toNumber()).toBe(1_800_000);
  });

  it("まず一般株式等の譲渡所得等の金額から控除し、控除しきれない分を上場株式等から控除する", () => {
    const result = estimateAngelTaxCapitalGainDeduction({
      stocks: [{ symbol: "A社", acquiredQuantity: 1, acquiredCostJpy: 5_000_000 }],
      generalStockCapitalGainJpy: 2_000_000,
      listedStockCapitalGainJpy: 10_000_000,
    });

    expect(result.usedAgainstGeneralStockJpy.toNumber()).toBe(2_000_000);
    expect(result.usedAgainstListedStockJpy.toNumber()).toBe(3_000_000);
    expect(result.totalUsedJpy.toNumber()).toBe(5_000_000);
    expect(result.generalStockCapitalGainAfterDeductionJpy.toNumber()).toBe(0);
    expect(result.listedStockCapitalGainAfterDeductionJpy.toNumber()).toBe(7_000_000);
  });

  it("控除対象額が両方の譲渡所得等の金額の合計を上回る場合、0円を下限にして超過分は繰り越さない", () => {
    const result = estimateAngelTaxCapitalGainDeduction({
      stocks: [{ symbol: "A社", acquiredQuantity: 1, acquiredCostJpy: 9_000_000 }],
      generalStockCapitalGainJpy: 1_000_000,
      listedStockCapitalGainJpy: 2_000_000,
    });

    expect(result.totalUsedJpy.toNumber()).toBe(3_000_000);
    expect(result.unusedJpy.toNumber()).toBe(6_000_000);
    expect(result.generalStockCapitalGainAfterDeductionJpy.toNumber()).toBe(0);
    expect(result.listedStockCapitalGainAfterDeductionJpy.toNumber()).toBe(0);
    expect(
      result.notes.some((n) => n.includes("適用できなかった")),
    ).toBe(true);
  });

  it("複数銘柄の控除対象額を合算する", () => {
    const result = estimateAngelTaxCapitalGainDeduction({
      stocks: [
        { symbol: "A社", acquiredQuantity: 10, acquiredCostJpy: 1_000_000 },
        { symbol: "B社", acquiredQuantity: 20, acquiredCostJpy: 2_000_000 },
      ],
      generalStockCapitalGainJpy: 0,
      listedStockCapitalGainJpy: 10_000_000,
    });

    expect(result.totalDeductionBeforeLimitJpy.toNumber()).toBe(3_000_000);
    expect(result.stocks).toHaveLength(2);
  });

  it("適用を受けた金額が20億円を超える場合は取得価額調整の対象外である旨を注記する", () => {
    const result = estimateAngelTaxCapitalGainDeduction({
      stocks: [{ symbol: "A社", acquiredQuantity: 1, acquiredCostJpy: 3_000_000_000 }],
      generalStockCapitalGainJpy: 0,
      listedStockCapitalGainJpy: 3_000_000_000,
    });

    expect(result.totalUsedJpy.toNumber()).toBe(3_000_000_000);
    expect(result.exceedsAdjustmentExemptionThreshold).toBe(true);
    expect(result.notes.some((n) => n.includes("20億円"))).toBe(true);
  });

  it("適用を受けた金額が20億円以下の場合は取得価額調整対象外の注記を出さない", () => {
    const result = estimateAngelTaxCapitalGainDeduction({
      stocks: [{ symbol: "A社", acquiredQuantity: 1, acquiredCostJpy: 2_000_000_000 }],
      generalStockCapitalGainJpy: 0,
      listedStockCapitalGainJpy: 2_000_000_000,
    });

    expect(result.exceedsAdjustmentExemptionThreshold).toBe(false);
  });

  it("取得数量が0の場合は平均取得単価・控除額ともに0円とする", () => {
    const result = estimateAngelTaxCapitalGainDeduction({
      stocks: [{ symbol: "A社", acquiredQuantity: 0, acquiredCostJpy: 0 }],
      generalStockCapitalGainJpy: 0,
      listedStockCapitalGainJpy: 1_000_000,
    });

    expect(result.stocks[0].averageUnitCostJpy.toNumber()).toBe(0);
    expect(result.totalDeductionBeforeLimitJpy.toNumber()).toBe(0);
  });

  it("銘柄が0件の場合は控除額0円になる", () => {
    const result = estimateAngelTaxCapitalGainDeduction({
      stocks: [],
      generalStockCapitalGainJpy: 1_000_000,
      listedStockCapitalGainJpy: 1_000_000,
    });

    expect(result.totalDeductionBeforeLimitJpy.toNumber()).toBe(0);
    expect(result.totalUsedJpy.toNumber()).toBe(0);
  });

  it("適用前の一般株式等の譲渡所得等の金額が負の値だとエラーになる", () => {
    expect(() =>
      estimateAngelTaxCapitalGainDeduction({
        stocks: [],
        generalStockCapitalGainJpy: -1,
        listedStockCapitalGainJpy: 0,
      }),
    ).toThrow();
  });

  it("適用前の上場株式等の譲渡所得等の金額が負の値だとエラーになる", () => {
    expect(() =>
      estimateAngelTaxCapitalGainDeduction({
        stocks: [],
        generalStockCapitalGainJpy: 0,
        listedStockCapitalGainJpy: -1,
      }),
    ).toThrow();
  });

  it("取得数量が負の値だとエラーになる", () => {
    expect(() =>
      estimateAngelTaxCapitalGainDeduction({
        stocks: [{ symbol: "A社", acquiredQuantity: -1, acquiredCostJpy: 0 }],
        generalStockCapitalGainJpy: 0,
        listedStockCapitalGainJpy: 0,
      }),
    ).toThrow();
  });

  it("取得価額の合計額が負の値だとエラーになる", () => {
    expect(() =>
      estimateAngelTaxCapitalGainDeduction({
        stocks: [{ symbol: "A社", acquiredQuantity: 1, acquiredCostJpy: -1 }],
        generalStockCapitalGainJpy: 0,
        listedStockCapitalGainJpy: 0,
      }),
    ).toThrow();
  });

  it("年中に譲渡・贈与した数量が取得数量を超える場合はエラーになる", () => {
    expect(() =>
      estimateAngelTaxCapitalGainDeduction({
        stocks: [
          {
            symbol: "A社",
            acquiredQuantity: 10,
            acquiredCostJpy: 1_000_000,
            disposedQuantitySameYear: 11,
          },
        ],
        generalStockCapitalGainJpy: 0,
        listedStockCapitalGainJpy: 0,
      }),
    ).toThrow();
  });
});
