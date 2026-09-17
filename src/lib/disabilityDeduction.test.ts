import { describe, expect, it } from "vitest";
import { estimateDisabilityDeduction } from "./disabilityDeduction";

function emptyInput() {
  return {
    taxpayerCategory: "NONE" as const,
    generalCount: 0,
    specialCount: 0,
    specialLivingTogetherCount: 0,
  };
}

describe("estimateDisabilityDeduction", () => {
  it("該当者がいない場合は控除額0になる", () => {
    const result = estimateDisabilityDeduction(emptyInput());

    expect(result.totalIncomeTaxDeductionJpy.toNumber()).toBe(0);
    expect(result.totalResidentTaxDeductionJpy.toNumber()).toBe(0);
  });

  it("納税者本人が障害者(一般)の場合は所得税27万円・住民税26万円になる", () => {
    const result = estimateDisabilityDeduction({
      ...emptyInput(),
      taxpayerCategory: "GENERAL",
    });

    expect(result.taxpayerIncomeTaxDeductionJpy.toNumber()).toBe(270_000);
    expect(result.taxpayerResidentTaxDeductionJpy.toNumber()).toBe(260_000);
  });

  it("納税者本人が特別障害者の場合は所得税40万円・住民税30万円になる", () => {
    const result = estimateDisabilityDeduction({
      ...emptyInput(),
      taxpayerCategory: "SPECIAL",
    });

    expect(result.taxpayerIncomeTaxDeductionJpy.toNumber()).toBe(400_000);
    expect(result.taxpayerResidentTaxDeductionJpy.toNumber()).toBe(300_000);
  });

  it("同一生計配偶者・扶養親族の障害者(一般)は1人あたり所得税27万円・住民税26万円で人数分加算される", () => {
    const result = estimateDisabilityDeduction({
      ...emptyInput(),
      generalCount: 2,
    });

    expect(result.relativesIncomeTaxDeductionJpy.toNumber()).toBe(540_000);
    expect(result.relativesResidentTaxDeductionJpy.toNumber()).toBe(520_000);
  });

  it("特別障害者(同居していないもの)は1人あたり所得税40万円・住民税30万円になる", () => {
    const result = estimateDisabilityDeduction({
      ...emptyInput(),
      specialCount: 1,
    });

    expect(result.relativesIncomeTaxDeductionJpy.toNumber()).toBe(400_000);
    expect(result.relativesResidentTaxDeductionJpy.toNumber()).toBe(300_000);
  });

  it("同居特別障害者は1人あたり所得税75万円・住民税53万円になる", () => {
    const result = estimateDisabilityDeduction({
      ...emptyInput(),
      specialLivingTogetherCount: 1,
    });

    expect(result.relativesIncomeTaxDeductionJpy.toNumber()).toBe(750_000);
    expect(result.relativesResidentTaxDeductionJpy.toNumber()).toBe(530_000);
  });

  it("納税者本人と親族の両方が該当する場合は合算した控除額になる", () => {
    const result = estimateDisabilityDeduction({
      taxpayerCategory: "SPECIAL",
      generalCount: 1,
      specialCount: 0,
      specialLivingTogetherCount: 1,
    });

    // 本人(特別障害者)40万円 + 一般27万円 + 同居特別障害者75万円 = 142万円
    expect(result.totalIncomeTaxDeductionJpy.toNumber()).toBe(1_420_000);
    // 本人(特別障害者)30万円 + 一般26万円 + 同居特別障害者53万円 = 109万円
    expect(result.totalResidentTaxDeductionJpy.toNumber()).toBe(1_090_000);
  });

  it("負の人数を入力するとエラーになる", () => {
    expect(() =>
      estimateDisabilityDeduction({
        ...emptyInput(),
        generalCount: -1,
      }),
    ).toThrow();
  });

  it("整数でない人数を入力するとエラーになる", () => {
    expect(() =>
      estimateDisabilityDeduction({
        ...emptyInput(),
        specialCount: 1.5,
      }),
    ).toThrow();
  });
});
