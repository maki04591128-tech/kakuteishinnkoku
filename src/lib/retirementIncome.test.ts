import { describe, expect, it } from "vitest";
import {
  calculateRetirementIncomeDeductionJpy,
  estimateRetirementIncome,
} from "./retirementIncome";

describe("calculateRetirementIncomeDeductionJpy", () => {
  it("勤続年数20年以下は40万円×勤続年数(最低80万円)", () => {
    expect(calculateRetirementIncomeDeductionJpy(10).toNumber()).toBe(4_000_000);
    // 1年未満切り上げ: 1.5年→2年
    expect(calculateRetirementIncomeDeductionJpy(1.5).toNumber()).toBe(800_000);
    // 最低保障額80万円(1年でも80万円を下回らない)
    expect(calculateRetirementIncomeDeductionJpy(1).toNumber()).toBe(800_000);
  });

  it("勤続年数20年超は800万円+70万円×(勤続年数-20年)", () => {
    // 国税庁の代表例: 勤続年数30年 → 800万円+70万円×10年=1,500万円
    expect(calculateRetirementIncomeDeductionJpy(30).toNumber()).toBe(15_000_000);
    // 端数切り上げ: 20年3か月→21年 → 800万円+70万円×1年=870万円
    expect(calculateRetirementIncomeDeductionJpy(20.25).toNumber()).toBe(8_700_000);
  });

  it("障害者になったことが直接の原因の退職は100万円加算", () => {
    expect(calculateRetirementIncomeDeductionJpy(10, true).toNumber()).toBe(5_000_000);
  });

  it("勤続年数が0以下だとエラーになる", () => {
    expect(() => calculateRetirementIncomeDeductionJpy(0)).toThrow();
  });
});

describe("estimateRetirementIncome", () => {
  it("一般の退職手当等(勤続年数30年、退職金2,000万円)", () => {
    // 退職所得控除額1,500万円、(2,000万円-1,500万円)×1/2=250万円
    const result = estimateRetirementIncome({ incomeJpy: 20_000_000, yearsOfService: 30 });
    expect(result.deductionJpy.toNumber()).toBe(15_000_000);
    expect(result.retirementIncomeJpy.toNumber()).toBe(2_500_000);
    expect(result.nationalTaxJpy.greaterThan(0)).toBe(true);
    expect(result.residentTaxJpy.toNumber()).toBe(250_000);
  });

  it("収入金額が退職所得控除額以下なら退職所得の金額は0円", () => {
    const result = estimateRetirementIncome({ incomeJpy: 3_000_000, yearsOfService: 10 });
    expect(result.deductionJpy.toNumber()).toBe(4_000_000);
    expect(result.retirementIncomeJpy.toNumber()).toBe(0);
    expect(result.nationalTaxJpy.toNumber()).toBe(0);
    expect(result.residentTaxJpy.toNumber()).toBe(0);
  });

  it("特定役員退職手当等(役員等勤続年数5年以下)は2分の1課税の適用なし", () => {
    // 退職所得控除額200万円(40万円×5年)、収入800万円-200万円=600万円をそのまま退職所得とする
    const result = estimateRetirementIncome({
      incomeJpy: 8_000_000,
      yearsOfService: 5,
      category: "SPECIFIED_OFFICER",
    });
    expect(result.deductionJpy.toNumber()).toBe(2_000_000);
    expect(result.retirementIncomeJpy.toNumber()).toBe(6_000_000);
  });

  it("短期退職手当等で「収入金額-退職所得控除額」が300万円以下なら通常どおり2分の1課税", () => {
    // 退職所得控除額200万円、収入400万円-200万円=200万円(300万円以下)×1/2=100万円
    const result = estimateRetirementIncome({
      incomeJpy: 4_000_000,
      yearsOfService: 5,
      category: "SHORT_TERM",
    });
    expect(result.retirementIncomeJpy.toNumber()).toBe(1_000_000);
  });

  it("短期退職手当等で「収入金額-退職所得控除額」が300万円を超える部分は2分の1課税なし", () => {
    // 国税庁Q&Aの計算例: 収入800万円、勤続年数4年(控除額160万円)
    // 収入金額-退職所得控除額=800万円-160万円=640万円(300万円超)
    // 退職所得の金額=150万円+(640万円-300万円)=490万円
    const result = estimateRetirementIncome({
      incomeJpy: 8_000_000,
      yearsOfService: 4,
      category: "SHORT_TERM",
    });
    expect(result.deductionJpy.toNumber()).toBe(1_600_000);
    expect(result.retirementIncomeJpy.toNumber()).toBe(4_900_000);
  });

  it("収入金額が負の値だとエラーになる", () => {
    expect(() => estimateRetirementIncome({ incomeJpy: -1, yearsOfService: 10 })).toThrow();
  });
});
