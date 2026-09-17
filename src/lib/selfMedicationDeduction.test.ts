import { describe, expect, it } from "vitest";
import {
  compareMedicalDeductionOptions,
  estimateSelfMedicationDeduction,
} from "./selfMedicationDeduction";

describe("estimateSelfMedicationDeduction", () => {
  it("購入費 - 保険金 - 12,000円を控除額とする", () => {
    // 購入費5万円 - 保険金1万円 - 12,000円 = 28,000円
    const result = estimateSelfMedicationDeduction({
      totalOtcDrugPurchasesJpy: 50_000,
      insuranceReimbursementJpy: 10_000,
      engagedInHealthInitiatives: true,
    });

    expect(result.netOtcDrugPurchasesJpy.toNumber()).toBe(40_000);
    expect(result.thresholdJpy.toNumber()).toBe(12_000);
    expect(result.deductionJpy.toNumber()).toBe(28_000);
    expect(result.notes.join("")).not.toContain("一定の取組");
  });

  it("差引金額が12,000円以下の場合は控除額0円になる(マイナスにはならない)", () => {
    const result = estimateSelfMedicationDeduction({
      totalOtcDrugPurchasesJpy: 10_000,
      insuranceReimbursementJpy: 0,
      engagedInHealthInitiatives: true,
    });

    expect(result.deductionJpy.toNumber()).toBe(0);
  });

  it("控除額は88,000円が上限になる", () => {
    const result = estimateSelfMedicationDeduction({
      totalOtcDrugPurchasesJpy: 500_000,
      insuranceReimbursementJpy: 0,
      engagedInHealthInitiatives: true,
    });

    expect(result.deductionJpy.toNumber()).toBe(88_000);
  });

  it("保険金等の補填額が購入費を上回っても差引金額は0円未満にならない", () => {
    const result = estimateSelfMedicationDeduction({
      totalOtcDrugPurchasesJpy: 10_000,
      insuranceReimbursementJpy: 50_000,
      engagedInHealthInitiatives: true,
    });

    expect(result.netOtcDrugPurchasesJpy.toNumber()).toBe(0);
    expect(result.deductionJpy.toNumber()).toBe(0);
  });

  it("一定の取組を行っていない場合は注記が付く", () => {
    const result = estimateSelfMedicationDeduction({
      totalOtcDrugPurchasesJpy: 50_000,
      insuranceReimbursementJpy: 0,
      engagedInHealthInitiatives: false,
    });

    expect(result.notes.join("")).toContain("一定の取組");
  });

  it("負の入力値はエラーになる", () => {
    expect(() =>
      estimateSelfMedicationDeduction({
        totalOtcDrugPurchasesJpy: -1,
        insuranceReimbursementJpy: 0,
        engagedInHealthInitiatives: true,
      }),
    ).toThrow();
    expect(() =>
      estimateSelfMedicationDeduction({
        totalOtcDrugPurchasesJpy: 50_000,
        insuranceReimbursementJpy: -1,
        engagedInHealthInitiatives: true,
      }),
    ).toThrow();
  });
});

describe("compareMedicalDeductionOptions", () => {
  it("医療費控除の方が大きい場合はMEDICAL_EXPENSEを推奨する", () => {
    const result = compareMedicalDeductionOptions(150_000, 28_000);

    expect(result.recommended).toBe("MEDICAL_EXPENSE");
    expect(result.advantageJpy.toNumber()).toBe(122_000);
  });

  it("セルフメディケーション税制の方が大きい場合はSELF_MEDICATIONを推奨する", () => {
    const result = compareMedicalDeductionOptions(0, 28_000);

    expect(result.recommended).toBe("SELF_MEDICATION");
    expect(result.advantageJpy.toNumber()).toBe(28_000);
  });

  it("同額(0円同士を含む)の場合はEITHERを返す", () => {
    const result = compareMedicalDeductionOptions(0, 0);

    expect(result.recommended).toBe("EITHER");
    expect(result.advantageJpy.toNumber()).toBe(0);
  });
});
