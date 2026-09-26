import { describe, expect, it } from "vitest";
import {
  calculateAngelTaxCurrentYearOffset,
  calculateAngelTaxDeemedTransferLoss,
  calculateAngelTaxLossCarryforward,
} from "./angelTaxLossCarryforward";

describe("calculateAngelTaxDeemedTransferLoss", () => {
  it("破産手続開始の決定による価値喪失で取得価額と同額のみなし譲渡損失になる", () => {
    const result = calculateAngelTaxDeemedTransferLoss({
      event: "BANKRUPTCY",
      acquisitionCostJpy: 3_000_000,
    });
    expect(result.deemedTransferLossJpy.toString()).toBe("3000000");
  });

  it("解散(清算結了)による価値喪失にも対応する", () => {
    const result = calculateAngelTaxDeemedTransferLoss({
      event: "DISSOLUTION",
      acquisitionCostJpy: 1_000_000,
    });
    expect(result.deemedTransferLossJpy.toString()).toBe("1000000");
  });

  it("取得価額が負値の場合はエラーになる", () => {
    expect(() =>
      calculateAngelTaxDeemedTransferLoss({
        event: "BANKRUPTCY",
        acquisitionCostJpy: -1,
      }),
    ).toThrow();
  });
});

describe("calculateAngelTaxCurrentYearOffset", () => {
  it("一般株式等の他の譲渡益で特定株式の損失が吸収される場合は上場株式等への控除は生じない", () => {
    const result = calculateAngelTaxCurrentYearOffset({
      specificStockLossJpy: 1_000_000,
      generalStockNetGainJpy: 2_000_000, // 特定株式の損失を含めて計算した後も黒字
      listedStockCapitalGainJpy: 5_000_000,
    });
    expect(result.generalStockTaxableGainJpy.toString()).toBe("2000000");
    expect(result.unabsorbedSpecificStockLossJpy.toString()).toBe("0");
    expect(result.usedAgainstListedStockJpy.toString()).toBe("0");
    expect(result.listedStockCapitalGainAfterJpy.toString()).toBe("5000000");
    expect(result.newLossForCarryforwardJpy.toString()).toBe("0");
  });

  it("一般株式等が赤字になった部分に限り上場株式等の譲渡所得等から控除できる", () => {
    const result = calculateAngelTaxCurrentYearOffset({
      specificStockLossJpy: 3_000_000,
      generalStockNetGainJpy: -1_000_000, // 特定株式の損失込みで1,000,000円の赤字
      listedStockCapitalGainJpy: 5_000_000,
    });
    expect(result.generalStockTaxableGainJpy.toString()).toBe("0");
    // 一般株式等プールの赤字1,000,000円分のみ「控除しきれなかった」とみなす
    expect(result.unabsorbedSpecificStockLossJpy.toString()).toBe("1000000");
    expect(result.usedAgainstListedStockJpy.toString()).toBe("1000000");
    expect(result.listedStockCapitalGainAfterJpy.toString()).toBe("4000000");
    expect(result.newLossForCarryforwardJpy.toString()).toBe("0");
  });

  it("上場株式等の譲渡所得等の金額を超える部分は翌年以後への繰越対象になる", () => {
    const result = calculateAngelTaxCurrentYearOffset({
      specificStockLossJpy: 8_000_000,
      generalStockNetGainJpy: -2_000_000,
      listedStockCapitalGainJpy: 1_500_000,
    });
    expect(result.unabsorbedSpecificStockLossJpy.toString()).toBe("2000000");
    expect(result.usedAgainstListedStockJpy.toString()).toBe("1500000");
    expect(result.listedStockCapitalGainAfterJpy.toString()).toBe("0");
    expect(result.newLossForCarryforwardJpy.toString()).toBe("500000");
  });

  it("特定株式に係る損失が負値の場合はエラーになる", () => {
    expect(() =>
      calculateAngelTaxCurrentYearOffset({
        specificStockLossJpy: -1,
        generalStockNetGainJpy: 0,
        listedStockCapitalGainJpy: 0,
      }),
    ).toThrow();
  });
});

describe("calculateAngelTaxLossCarryforward", () => {
  it("繰越損失が無ければそのまま課税対象になる", () => {
    const result = calculateAngelTaxLossCarryforward(2026, 300_000, 700_000, 0, []);
    expect(result.totalUsedAgainstGeneralStockJpy.toString()).toBe("0");
    expect(result.totalUsedAgainstListedStockJpy.toString()).toBe("0");
    expect(result.generalStockTaxableGainAfterCarryforwardJpy.toString()).toBe(
      "300000",
    );
    expect(result.listedStockCapitalGainAfterCarryforwardJpy.toString()).toBe(
      "700000",
    );
    expect(result.carryforwardToNextYear).toHaveLength(0);
  });

  it("一般株式等→上場株式等の順に控除する", () => {
    const result = calculateAngelTaxLossCarryforward(
      2026,
      400_000, // 一般株式等の譲渡所得等の金額
      1_000_000, // 上場株式等の譲渡所得等の金額
      0,
      [{ originYear: 2024, remainingAmountJpy: 900_000 }],
    );

    expect(result.usedByOriginYear).toEqual([
      {
        originYear: 2024,
        usedAgainstGeneralStockJpy: expect.anything(),
        usedAgainstListedStockJpy: expect.anything(),
      },
    ]);
    expect(result.usedByOriginYear[0].usedAgainstGeneralStockJpy.toString()).toBe(
      "400000",
    );
    expect(result.usedByOriginYear[0].usedAgainstListedStockJpy.toString()).toBe(
      "500000",
    );
    expect(result.generalStockTaxableGainAfterCarryforwardJpy.toString()).toBe("0");
    expect(result.listedStockCapitalGainAfterCarryforwardJpy.toString()).toBe(
      "500000",
    );
    expect(result.carryforwardToNextYear).toHaveLength(0);
  });

  it("発生年の古い順に使用し、当年新規分は最後に扱われる", () => {
    const result = calculateAngelTaxLossCarryforward(
      2026,
      100_000,
      200_000,
      50_000, // 当年新たに発生した未控除額
      [{ originYear: 2025, remainingAmountJpy: 250_000 }],
    );

    // 2025年分(250,000)がまず一般株式等100,000→上場株式等150,000に使われ切り、
    // 上場株式等の残り50,000は当年新規分(2026年分)に使われる。
    expect(result.usedByOriginYear).toEqual([
      {
        originYear: 2025,
        usedAgainstGeneralStockJpy: expect.anything(),
        usedAgainstListedStockJpy: expect.anything(),
      },
      {
        originYear: 2026,
        usedAgainstGeneralStockJpy: expect.anything(),
        usedAgainstListedStockJpy: expect.anything(),
      },
    ]);
    expect(result.usedByOriginYear[0].usedAgainstGeneralStockJpy.toString()).toBe(
      "100000",
    );
    expect(result.usedByOriginYear[0].usedAgainstListedStockJpy.toString()).toBe(
      "150000",
    );
    expect(result.usedByOriginYear[1].usedAgainstGeneralStockJpy.toString()).toBe("0");
    expect(result.usedByOriginYear[1].usedAgainstListedStockJpy.toString()).toBe(
      "50000",
    );
    expect(result.generalStockTaxableGainAfterCarryforwardJpy.toString()).toBe("0");
    expect(result.listedStockCapitalGainAfterCarryforwardJpy.toString()).toBe("0");
    expect(result.carryforwardToNextYear).toHaveLength(0);
  });

  it("発生年から3年を超えた繰越損失は控除に使えず期限切れになる", () => {
    const result = calculateAngelTaxLossCarryforward(
      2026,
      1_000_000,
      1_000_000,
      0,
      [
        { originYear: 2021, remainingAmountJpy: 150_000 },
        { originYear: 2024, remainingAmountJpy: 50_000 },
      ],
    );

    expect(result.expiredByOriginYear).toEqual([
      { originYear: 2021, expiredAmountJpy: expect.anything() },
    ]);
    expect(result.expiredByOriginYear[0].expiredAmountJpy.toString()).toBe("150000");
    expect(result.usedByOriginYear).toEqual([
      {
        originYear: 2024,
        usedAgainstGeneralStockJpy: expect.anything(),
        usedAgainstListedStockJpy: expect.anything(),
      },
    ]);
    expect(result.usedByOriginYear[0].usedAgainstGeneralStockJpy.toString()).toBe(
      "50000",
    );
  });

  it("控除しきれない場合は翌年に繰り越す", () => {
    const result = calculateAngelTaxLossCarryforward(2026, 0, 0, 300_000, []);
    expect(result.carryforwardToNextYear).toEqual([
      { originYear: 2026, remainingAmountJpy: expect.anything() },
    ]);
    expect(result.carryforwardToNextYear[0].remainingAmountJpy.toString()).toBe(
      "300000",
    );
  });

  it("一般株式等・上場株式等の金額が負値の場合はエラーになる", () => {
    expect(() => calculateAngelTaxLossCarryforward(2026, -1, 0, 0, [])).toThrow();
    expect(() => calculateAngelTaxLossCarryforward(2026, 0, -1, 0, [])).toThrow();
    expect(() => calculateAngelTaxLossCarryforward(2026, 0, 0, -1, [])).toThrow();
  });
});
