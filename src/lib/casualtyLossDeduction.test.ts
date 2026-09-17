import { describe, expect, it } from "vitest";
import { estimateCasualtyLossDeduction } from "./casualtyLossDeduction";

describe("estimateCasualtyLossDeduction", () => {
  it("損害が無ければ控除額は0になる", () => {
    const result = estimateCasualtyLossDeduction({
      damageAmountJpy: 0,
      disasterRelatedExpenseJpy: 0,
      insuranceReimbursementJpy: 0,
      totalIncomeJpy: 5_000_000,
    });

    expect(result.netLossJpy.toNumber()).toBe(0);
    expect(result.incomeTaxDeductionJpy.toNumber()).toBe(0);
    expect(result.residentTaxDeductionJpy.toNumber()).toBe(0);
  });

  it("算式1(総所得金額等×10%控除後)が算式2より多い場合はその金額になる", () => {
    const result = estimateCasualtyLossDeduction({
      damageAmountJpy: 1_000_000,
      disasterRelatedExpenseJpy: 0,
      insuranceReimbursementJpy: 0,
      totalIncomeJpy: 3_000_000,
    });

    // 差引損失額100万円 - 総所得金額等300万円×10% = 70万円
    expect(result.netLossJpy.toNumber()).toBe(1_000_000);
    expect(result.incomeBasedAmountJpy.toNumber()).toBe(700_000);
    // 災害関連支出が無いため算式2は0円(マイナスは0扱い)
    expect(result.expenseBasedAmountJpy.toNumber()).toBe(0);
    expect(result.incomeTaxDeductionJpy.toNumber()).toBe(700_000);
    expect(result.residentTaxDeductionJpy.toNumber()).toBe(700_000);
  });

  it("算式2(災害関連支出-5万円)が算式1より多い場合はその金額になる", () => {
    const result = estimateCasualtyLossDeduction({
      damageAmountJpy: 0,
      disasterRelatedExpenseJpy: 200_000,
      insuranceReimbursementJpy: 0,
      totalIncomeJpy: 1_000_000,
    });

    // 差引損失額20万円 - 総所得金額等100万円×10% = 10万円
    expect(result.incomeBasedAmountJpy.toNumber()).toBe(100_000);
    // 災害関連支出20万円 - 5万円 = 15万円
    expect(result.expenseBasedAmountJpy.toNumber()).toBe(150_000);
    expect(result.incomeTaxDeductionJpy.toNumber()).toBe(150_000);
  });

  it("保険金等はまず損害金額に充当し、残額を災害関連支出に充当する", () => {
    const result = estimateCasualtyLossDeduction({
      damageAmountJpy: 500_000,
      disasterRelatedExpenseJpy: 100_000,
      insuranceReimbursementJpy: 550_000,
      totalIncomeJpy: 0,
    });

    // 保険金55万円のうち50万円は損害金額に充当、残り5万円を災害関連支出10万円に充当
    expect(result.netDisasterRelatedExpenseJpy.toNumber()).toBe(50_000);
    expect(result.netLossJpy.toNumber()).toBe(50_000);
    expect(result.incomeTaxDeductionJpy.toNumber()).toBe(50_000);
  });

  it("保険金等が損害額・支出額の合計を上回っても差引損失額は0未満にならない", () => {
    const result = estimateCasualtyLossDeduction({
      damageAmountJpy: 300_000,
      disasterRelatedExpenseJpy: 100_000,
      insuranceReimbursementJpy: 1_000_000,
      totalIncomeJpy: 2_000_000,
    });

    expect(result.netLossJpy.toNumber()).toBe(0);
    expect(result.incomeTaxDeductionJpy.toNumber()).toBe(0);
  });

  it("負の値を入力するとエラーになる", () => {
    expect(() =>
      estimateCasualtyLossDeduction({
        damageAmountJpy: -1,
        disasterRelatedExpenseJpy: 0,
        insuranceReimbursementJpy: 0,
        totalIncomeJpy: 0,
      }),
    ).toThrow();
  });
});
