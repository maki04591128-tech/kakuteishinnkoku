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

describe("employmentIncomeDeductionJpy(令和7年度・8年度税制改正による最低保障額引上げ)", () => {
  it("令和7年分は収入190万円以下は65万円の定額で、190万円超は速算表と段差なく接続する", () => {
    expect(employmentIncomeDeductionJpy(1_000_000, 2025).toNumber()).toBe(650_000);
    expect(employmentIncomeDeductionJpy(1_900_000, 2025).toNumber()).toBe(650_000);
    // 190万円超の速算表(収入×30%+8万円)。190万円時点でちょうど65万円と一致し、段差は生じない
    expect(employmentIncomeDeductionJpy(1_900_001, 2025).toNumber()).toBeGreaterThan(650_000);
    expect(employmentIncomeDeductionJpy(2_000_000, 2025).toNumber()).toBe(680_000);
  });

  it("令和8年分・9年分は収入219万1,000円未満まで74万円の定額が続く", () => {
    expect(employmentIncomeDeductionJpy(1_000_000, 2026).toNumber()).toBe(740_000);
    expect(employmentIncomeDeductionJpy(1_900_000, 2026).toNumber()).toBe(740_000);
    // 190万円超でも定額74万円が続く(専用の金額表による、単純な速算表への切替ではない)
    expect(employmentIncomeDeductionJpy(2_000_000, 2026).toNumber()).toBe(740_000);
    expect(employmentIncomeDeductionJpy(2_190_999, 2027).toNumber()).toBe(740_000);
  });

  it("令和8年分・9年分の収入219万1,000円〜220万円未満は専用の金額表(1,000円刻みの丸め)による", () => {
    expect(employmentIncomeDeductionJpy(2_191_000, 2026).toNumber()).toBe(740_000);
    expect(employmentIncomeDeductionJpy(2_192_999, 2026).toNumber()).toBe(741_999);
    expect(employmentIncomeDeductionJpy(2_193_000, 2026).toNumber()).toBe(740_000);
    expect(employmentIncomeDeductionJpy(2_195_999, 2026).toNumber()).toBe(742_999);
    expect(employmentIncomeDeductionJpy(2_196_000, 2026).toNumber()).toBe(740_000);
    expect(employmentIncomeDeductionJpy(2_199_999, 2026).toNumber()).toBe(743_999);
  });

  it("令和8年分・9年分の収入220万円以上は通常の速算表(収入×30%+8万円)に戻る", () => {
    expect(employmentIncomeDeductionJpy(2_200_000, 2026).toNumber()).toBe(740_000);
    expect(employmentIncomeDeductionJpy(4_000_000, 2026).toNumber()).toBe(1_240_000);
    expect(employmentIncomeDeductionJpy(8_500_000, 2026).toNumber()).toBe(1_950_000);
  });

  it("令和10年分以後は最低保障額69万円が速算表に統合される(段差なし)", () => {
    expect(employmentIncomeDeductionJpy(1_000_000, 2028).toNumber()).toBe(690_000);
    expect(employmentIncomeDeductionJpy(1_900_000, 2028).toNumber()).toBe(690_000);
    // 収入×30%+8万円が69万円を上回る地点(約203万3,334円)から速算表どおりになる
    expect(employmentIncomeDeductionJpy(2_100_000, 2028).toNumber()).toBe(710_000);
    expect(employmentIncomeDeductionJpy(4_000_000, 2028).toNumber()).toBe(1_240_000);
    expect(employmentIncomeDeductionJpy(8_500_000, 2028).toNumber()).toBe(1_950_000);
  });

  it("収入が控除額を下回る場合は年分によらず収入金額自体にクランプする", () => {
    expect(employmentIncomeDeductionJpy(300_000, 2026).toNumber()).toBe(300_000);
    expect(employmentIncomeDeductionJpy(0, 2028).toNumber()).toBe(0);
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
