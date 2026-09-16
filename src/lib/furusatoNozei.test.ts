import { describe, expect, it } from "vitest";
import { estimateFurusatoNozeiLimit } from "./furusatoNozei";

describe("estimateFurusatoNozeiLimit", () => {
  it("住民税所得割額と限界税率20%の場合の速算式通りの上限額を返す", () => {
    // 総務省の速算式を手計算した既知値で検算する
    // 特例控除額の上限 = 300,000 × 20% = 60,000
    // 上限額 = 60,000 / (0.9 - 0.2 × 1.021) + 2,000
    const result = estimateFurusatoNozeiLimit({
      residentTaxIncomeLeviedJpy: 300_000,
      marginalIncomeTaxRate: 0.2,
    });

    const expected = 60_000 / (0.9 - 0.2 * 1.021) + 2_000;
    expect(result.specialDeductionLimitJpy.toNumber()).toBe(60_000);
    expect(result.fullDeductionDonationLimitJpy.toNumber()).toBeCloseTo(expected, 6);
  });

  it("限界税率が高いほど上限額は大きくなる(所得税での控除余地が減るため)", () => {
    const low = estimateFurusatoNozeiLimit({
      residentTaxIncomeLeviedJpy: 300_000,
      marginalIncomeTaxRate: 0.1,
    });
    const high = estimateFurusatoNozeiLimit({
      residentTaxIncomeLeviedJpy: 300_000,
      marginalIncomeTaxRate: 0.33,
    });

    expect(high.fullDeductionDonationLimitJpy.toNumber()).toBeGreaterThan(
      low.fullDeductionDonationLimitJpy.toNumber(),
    );
  });

  it("住民税所得割額が0円の場合は上限額も0円になる", () => {
    const result = estimateFurusatoNozeiLimit({
      residentTaxIncomeLeviedJpy: 0,
      marginalIncomeTaxRate: 0.1,
    });

    expect(result.fullDeductionDonationLimitJpy.toNumber()).toBe(0);
    expect(result.notes.join("")).toContain("控除額は発生しない");
  });

  it("負の入力値はエラーになる", () => {
    expect(() =>
      estimateFurusatoNozeiLimit({
        residentTaxIncomeLeviedJpy: -1,
        marginalIncomeTaxRate: 0.1,
      }),
    ).toThrow();
    expect(() =>
      estimateFurusatoNozeiLimit({
        residentTaxIncomeLeviedJpy: 300_000,
        marginalIncomeTaxRate: -0.1,
      }),
    ).toThrow();
  });

  it("所得税の限界税率が45%を超える入力はエラーになる", () => {
    expect(() =>
      estimateFurusatoNozeiLimit({
        residentTaxIncomeLeviedJpy: 300_000,
        marginalIncomeTaxRate: 0.5,
      }),
    ).toThrow();
  });
});
