import { describe, expect, it } from "vitest";
import { estimateSocialInsuranceDeduction } from "./socialInsuranceDeduction";

function emptyInput() {
  return {
    nationalPensionJpy: 0,
    nationalPensionFundJpy: 0,
    nationalPensionSupplementaryJpy: 0,
    nationalHealthInsuranceJpy: 0,
    lateStageElderlyMedicalInsuranceJpy: 0,
    longTermCareInsuranceJpy: 0,
    employeesPensionInsuranceJpy: 0,
    employmentInsuranceJpy: 0,
    otherJpy: 0,
  };
}

describe("estimateSocialInsuranceDeduction", () => {
  it("全区分の合計額がそのまま控除額になる(上限なし)", () => {
    const result = estimateSocialInsuranceDeduction({
      nationalPensionJpy: 200_000,
      nationalPensionFundJpy: 100_000,
      nationalPensionSupplementaryJpy: 4_800,
      nationalHealthInsuranceJpy: 300_000,
      lateStageElderlyMedicalInsuranceJpy: 50_000,
      longTermCareInsuranceJpy: 60_000,
      employeesPensionInsuranceJpy: 400_000,
      employmentInsuranceJpy: 20_000,
      otherJpy: 15_000,
    });

    expect(result.deductionJpy.toNumber()).toBe(
      200_000 + 100_000 + 4_800 + 300_000 + 50_000 + 60_000 + 400_000 + 20_000 + 15_000,
    );
  });

  it("入力が全て0円なら控除額も0円になる", () => {
    const result = estimateSocialInsuranceDeduction(emptyInput());

    expect(result.deductionJpy.toNumber()).toBe(0);
  });

  it("国民年金基金・付加保険料のみの入力でも合算される", () => {
    const result = estimateSocialInsuranceDeduction({
      ...emptyInput(),
      nationalPensionFundJpy: 816_000,
      nationalPensionSupplementaryJpy: 4_800,
    });

    expect(result.deductionJpy.toNumber()).toBe(820_800);
  });

  it("負の入力値はエラーになる", () => {
    expect(() =>
      estimateSocialInsuranceDeduction({
        ...emptyInput(),
        nationalPensionJpy: -1,
      }),
    ).toThrow();
    expect(() =>
      estimateSocialInsuranceDeduction({
        ...emptyInput(),
        nationalHealthInsuranceJpy: -1,
      }),
    ).toThrow();
    expect(() =>
      estimateSocialInsuranceDeduction({
        ...emptyInput(),
        otherJpy: -1,
      }),
    ).toThrow();
  });
});
