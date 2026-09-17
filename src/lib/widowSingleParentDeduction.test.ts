import { describe, expect, it } from "vitest";
import { estimateWidowSingleParentDeduction } from "./widowSingleParentDeduction";

describe("estimateWidowSingleParentDeduction", () => {
  it("該当なしの場合は控除額0になる", () => {
    const result = estimateWidowSingleParentDeduction({
      category: "NONE",
      workingStudent: false,
    });

    expect(result.totalIncomeTaxDeductionJpy.toNumber()).toBe(0);
    expect(result.totalResidentTaxDeductionJpy.toNumber()).toBe(0);
  });

  it("寡婦控除は所得税27万円・住民税26万円になる", () => {
    const result = estimateWidowSingleParentDeduction({
      category: "WIDOW",
      workingStudent: false,
    });

    expect(result.categoryIncomeTaxDeductionJpy.toNumber()).toBe(270_000);
    expect(result.categoryResidentTaxDeductionJpy.toNumber()).toBe(260_000);
    expect(result.totalIncomeTaxDeductionJpy.toNumber()).toBe(270_000);
    expect(result.totalResidentTaxDeductionJpy.toNumber()).toBe(260_000);
  });

  it("ひとり親控除は所得税35万円・住民税30万円になる", () => {
    const result = estimateWidowSingleParentDeduction({
      category: "SINGLE_PARENT",
      workingStudent: false,
    });

    expect(result.categoryIncomeTaxDeductionJpy.toNumber()).toBe(350_000);
    expect(result.categoryResidentTaxDeductionJpy.toNumber()).toBe(300_000);
  });

  it("勤労学生控除は所得税27万円・住民税26万円になる", () => {
    const result = estimateWidowSingleParentDeduction({
      category: "NONE",
      workingStudent: true,
    });

    expect(result.workingStudentIncomeTaxDeductionJpy.toNumber()).toBe(270_000);
    expect(result.workingStudentResidentTaxDeductionJpy.toNumber()).toBe(260_000);
    expect(result.totalIncomeTaxDeductionJpy.toNumber()).toBe(270_000);
    expect(result.totalResidentTaxDeductionJpy.toNumber()).toBe(260_000);
  });

  it("ひとり親控除と勤労学生控除は併用でき合算される", () => {
    const result = estimateWidowSingleParentDeduction({
      category: "SINGLE_PARENT",
      workingStudent: true,
    });

    // ひとり親35万円 + 勤労学生27万円 = 62万円
    expect(result.totalIncomeTaxDeductionJpy.toNumber()).toBe(620_000);
    // ひとり親30万円 + 勤労学生26万円 = 56万円
    expect(result.totalResidentTaxDeductionJpy.toNumber()).toBe(560_000);
  });
});
