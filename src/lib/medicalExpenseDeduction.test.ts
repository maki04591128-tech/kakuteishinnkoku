import { describe, expect, it } from "vitest";
import { estimateMedicalExpenseDeduction } from "./medicalExpenseDeduction";

describe("estimateMedicalExpenseDeduction", () => {
  it("総所得金額等が200万円以上の場合は10万円が足切り額になる", () => {
    // 医療費30万円 - 保険金5万円 - 10万円 = 15万円
    const result = estimateMedicalExpenseDeduction({
      totalMedicalExpensesJpy: 300_000,
      insuranceReimbursementJpy: 50_000,
      totalIncomeJpy: 5_000_000,
    });

    expect(result.netMedicalExpensesJpy.toNumber()).toBe(250_000);
    expect(result.thresholdJpy.toNumber()).toBe(100_000);
    expect(result.deductionJpy.toNumber()).toBe(150_000);
  });

  it("総所得金額等が200万円未満の場合は5%相当額が足切り額になる", () => {
    // 総所得150万円の5% = 75,000円 < 10万円
    const result = estimateMedicalExpenseDeduction({
      totalMedicalExpensesJpy: 300_000,
      insuranceReimbursementJpy: 0,
      totalIncomeJpy: 1_500_000,
    });

    expect(result.fivePercentOfIncomeJpy.toNumber()).toBe(75_000);
    expect(result.thresholdJpy.toNumber()).toBe(75_000);
    expect(result.deductionJpy.toNumber()).toBe(225_000);
    expect(result.notes.join("")).toContain("200万円未満");
  });

  it("差引金額が足切り額以下の場合は控除額0円になる(マイナスにはならない)", () => {
    const result = estimateMedicalExpenseDeduction({
      totalMedicalExpensesJpy: 80_000,
      insuranceReimbursementJpy: 0,
      totalIncomeJpy: 5_000_000,
    });

    expect(result.deductionJpy.toNumber()).toBe(0);
  });

  it("保険金等の補填額が医療費を上回っても差引金額は0円未満にならない", () => {
    const result = estimateMedicalExpenseDeduction({
      totalMedicalExpensesJpy: 100_000,
      insuranceReimbursementJpy: 500_000,
      totalIncomeJpy: 5_000_000,
    });

    expect(result.netMedicalExpensesJpy.toNumber()).toBe(0);
    expect(result.deductionJpy.toNumber()).toBe(0);
  });

  it("控除額は200万円が上限になる", () => {
    const result = estimateMedicalExpenseDeduction({
      totalMedicalExpensesJpy: 10_000_000,
      insuranceReimbursementJpy: 0,
      totalIncomeJpy: 10_000_000,
    });

    expect(result.deductionJpy.toNumber()).toBe(2_000_000);
  });

  it("負の入力値はエラーになる", () => {
    expect(() =>
      estimateMedicalExpenseDeduction({
        totalMedicalExpensesJpy: -1,
        insuranceReimbursementJpy: 0,
        totalIncomeJpy: 5_000_000,
      }),
    ).toThrow();
    expect(() =>
      estimateMedicalExpenseDeduction({
        totalMedicalExpensesJpy: 100_000,
        insuranceReimbursementJpy: -1,
        totalIncomeJpy: 5_000_000,
      }),
    ).toThrow();
    expect(() =>
      estimateMedicalExpenseDeduction({
        totalMedicalExpensesJpy: 100_000,
        insuranceReimbursementJpy: 0,
        totalIncomeJpy: -1,
      }),
    ).toThrow();
  });
});
