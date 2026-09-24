import { describe, expect, it } from "vitest";
import {
  employmentIncomeDeductionJpy,
  estimateSpecificExpenseDeduction,
} from "./specificExpenseDeduction";

describe("employmentIncomeDeductionJpy", () => {
  it("収入162.5万円以下は55万円の定額", () => {
    expect(employmentIncomeDeductionJpy(1_000_000).toNumber()).toBe(550_000);
    expect(employmentIncomeDeductionJpy(1_625_000).toNumber()).toBe(550_000);
  });

  it("収入が控除額を下回る場合は収入金額自体を上限にクランプする(所得はマイナスにならない)", () => {
    expect(employmentIncomeDeductionJpy(300_000).toNumber()).toBe(300_000);
  });

  it("収入400万円は速算表どおり(400万円×20%+44万円=124万円)", () => {
    expect(employmentIncomeDeductionJpy(4_000_000).toNumber()).toBe(1_240_000);
  });

  it("収入800万円は速算表どおり(800万円×10%+110万円=190万円)", () => {
    expect(employmentIncomeDeductionJpy(8_000_000).toNumber()).toBe(1_900_000);
  });

  it("収入850万円超は195万円で頭打ち", () => {
    expect(employmentIncomeDeductionJpy(8_500_000).toNumber()).toBe(1_950_000);
    expect(employmentIncomeDeductionJpy(10_000_000).toNumber()).toBe(1_950_000);
  });

  it("負の収入金額はエラー", () => {
    expect(() => employmentIncomeDeductionJpy(-1)).toThrow();
  });
});

describe("estimateSpecificExpenseDeduction", () => {
  it("特定支出の合計が基準額(給与所得控除額の1/2)以下なら控除額は0円", () => {
    // 給与収入500万円: 給与所得控除額144万円、基準額72万円
    const result = estimateSpecificExpenseDeduction({
      salaryIncomeJpy: 5_000_000,
      commutingExpenseJpy: 300_000,
      relocationExpenseJpy: 0,
      trainingExpenseJpy: 0,
      qualificationExpenseJpy: 0,
      returningHomeExpenseJpy: 0,
      jobRelatedExpenseJpy: 400_000,
    });

    expect(result.employmentIncomeDeductionJpy.toNumber()).toBe(1_440_000);
    expect(result.thresholdJpy.toNumber()).toBe(720_000);
    expect(result.totalSpecificExpenseJpy.toNumber()).toBe(700_000);
    expect(result.specificExpenseDeductionJpy.toNumber()).toBe(0);
    expect(result.adjustedEmploymentIncomeJpy.toNumber()).toBe(5_000_000 - 1_440_000);
  });

  it("特定支出の合計が基準額を超える部分のみ控除額になる", () => {
    // 給与収入500万円: 給与所得控除額144万円、基準額72万円
    const result = estimateSpecificExpenseDeduction({
      salaryIncomeJpy: 5_000_000,
      commutingExpenseJpy: 300_000,
      relocationExpenseJpy: 200_000,
      trainingExpenseJpy: 100_000,
      qualificationExpenseJpy: 0,
      returningHomeExpenseJpy: 0,
      jobRelatedExpenseJpy: 400_000,
    });

    expect(result.totalSpecificExpenseJpy.toNumber()).toBe(1_000_000);
    expect(result.specificExpenseDeductionJpy.toNumber()).toBe(1_000_000 - 720_000);
    expect(result.adjustedEmploymentIncomeJpy.toNumber()).toBe(
      5_000_000 - 1_440_000 - (1_000_000 - 720_000),
    );
  });

  it("勤務必要経費は65万円が上限で、超過分は合計額に算入しない", () => {
    const result = estimateSpecificExpenseDeduction({
      salaryIncomeJpy: 5_000_000,
      commutingExpenseJpy: 0,
      relocationExpenseJpy: 0,
      trainingExpenseJpy: 0,
      qualificationExpenseJpy: 0,
      returningHomeExpenseJpy: 0,
      jobRelatedExpenseJpy: 800_000,
    });

    expect(result.cappedJobRelatedExpenseJpy.toNumber()).toBe(650_000);
    expect(result.totalSpecificExpenseJpy.toNumber()).toBe(650_000);
  });

  it("特定支出控除適用後の給与所得は0円が下限", () => {
    const result = estimateSpecificExpenseDeduction({
      salaryIncomeJpy: 600_000,
      commutingExpenseJpy: 500_000,
      relocationExpenseJpy: 0,
      trainingExpenseJpy: 0,
      qualificationExpenseJpy: 0,
      returningHomeExpenseJpy: 0,
      jobRelatedExpenseJpy: 0,
    });

    expect(result.adjustedEmploymentIncomeJpy.toNumber()).toBe(0);
  });

  it("負の入力値はエラー", () => {
    expect(() =>
      estimateSpecificExpenseDeduction({
        salaryIncomeJpy: 5_000_000,
        commutingExpenseJpy: -1,
        relocationExpenseJpy: 0,
        trainingExpenseJpy: 0,
        qualificationExpenseJpy: 0,
        returningHomeExpenseJpy: 0,
        jobRelatedExpenseJpy: 0,
      }),
    ).toThrow();
  });
});
