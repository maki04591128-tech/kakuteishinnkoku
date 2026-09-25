import { describe, expect, it } from "vitest";
import {
  calculateRetirementIncomeDeductionJpy,
  estimateRetirementIncome,
  resolveOverlapDeductionLookbackYears,
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

describe("resolveOverlapDeductionLookbackYears", () => {
  it("今回がDC一時金なら前年以前19年内", () => {
    expect(resolveOverlapDeductionLookbackYears(true, "REGULAR", 2010)).toBe(19);
    expect(resolveOverlapDeductionLookbackYears(true, "DC_LUMP_SUM", 2010)).toBe(19);
  });

  it("今回が通常の退職手当等で前も通常なら前年以前4年内", () => {
    expect(resolveOverlapDeductionLookbackYears(false, "REGULAR", 2020)).toBe(4);
  });

  it("今回が通常の退職手当等で前がDC一時金の場合、令和8年(2026年)以後の支給なら前年以前9年内、それより前なら4年内", () => {
    expect(resolveOverlapDeductionLookbackYears(false, "DC_LUMP_SUM", 2026)).toBe(9);
    expect(resolveOverlapDeductionLookbackYears(false, "DC_LUMP_SUM", 2025)).toBe(4);
  });
});

describe("estimateRetirementIncome の重複排除(前の退職手当等)", () => {
  it("重複期間分の控除額を今回の退職所得控除額から差し引く", () => {
    // 勤続27年(切り上げ不要)・退職金1,500万円、前のB社と6年重複
    // 通常の控除額: 800万円+70万円×(27-20)=1,290万円
    // 重複排除: 40万円×6年=240万円 → 控除額1,290万円-240万円=1,050万円
    const result = estimateRetirementIncome({
      incomeJpy: 15_000_000,
      yearsOfService: 27,
      paymentYear: 2026,
      priorPayment: { paymentYear: 2023, kind: "REGULAR", overlappingYearsOfService: 6 },
    });
    expect(result.overlapDeductionReductionJpy.toNumber()).toBe(2_400_000);
    expect(result.deductionJpy.toNumber()).toBe(10_500_000);
  });

  it("重複する勤続年数の端数は切り捨てる", () => {
    const result = estimateRetirementIncome({
      incomeJpy: 15_000_000,
      yearsOfService: 27,
      paymentYear: 2026,
      priorPayment: { paymentYear: 2023, kind: "REGULAR", overlappingYearsOfService: 6.9 },
    });
    // 6.9年→6年 → 40万円×6年=240万円(7年扱いにはならない)
    expect(result.overlapDeductionReductionJpy.toNumber()).toBe(2_400_000);
  });

  it("前の退職手当等が対象期間(前年以前4年内)より前なら重複排除は適用しない", () => {
    const result = estimateRetirementIncome({
      incomeJpy: 15_000_000,
      yearsOfService: 27,
      paymentYear: 2026,
      priorPayment: { paymentYear: 2020, kind: "REGULAR", overlappingYearsOfService: 6 },
    });
    expect(result.overlapDeductionReductionJpy.toNumber()).toBe(0);
    expect(result.deductionJpy.toNumber()).toBe(12_900_000);
  });

  it("今回がDC一時金の場合、前年以前19年内なら重複排除が適用される", () => {
    const result = estimateRetirementIncome({
      incomeJpy: 10_000_000,
      yearsOfService: 20,
      paymentYear: 2026,
      isDefinedContributionLumpSum: true,
      priorPayment: { paymentYear: 2010, kind: "REGULAR", overlappingYearsOfService: 10 },
    });
    // 通常の控除額: 40万円×20年=800万円、重複排除: 40万円×10年=400万円 → 400万円
    expect(result.deductionJpy.toNumber()).toBe(4_000_000);
  });

  it("前が令和8年以後支給のDC一時金なら前年以前9年内(改正前は4年内)が重複排除の対象になる", () => {
    const result = estimateRetirementIncome({
      incomeJpy: 15_000_000,
      yearsOfService: 27,
      paymentYear: 2036,
      priorPayment: { paymentYear: 2030, kind: "DC_LUMP_SUM", overlappingYearsOfService: 6 },
    });
    // 前の支給(2030年)は今回(2036年)の6年前。改正前の4年内には収まらないが、
    // 前がDC一時金かつ令和8年(2026年)以後の支給のため対象期間が9年内に延長され重複排除が適用される
    expect(result.overlapDeductionReductionJpy.toNumber()).toBe(2_400_000);
    expect(result.deductionJpy.toNumber()).toBe(10_500_000);
  });

  it("前が令和8年より前支給のDC一時金なら改正前の前年以前4年内までしか対象にならない", () => {
    const result = estimateRetirementIncome({
      incomeJpy: 15_000_000,
      yearsOfService: 27,
      paymentYear: 2031,
      priorPayment: { paymentYear: 2025, kind: "DC_LUMP_SUM", overlappingYearsOfService: 6 },
    });
    // 前の支給(2025年)は令和8年より前のため対象期間は4年内のまま。gap=6年は対象外
    expect(result.overlapDeductionReductionJpy.toNumber()).toBe(0);
  });

  it("前の退職手当等の支給年が今回以後だとエラーになる", () => {
    expect(() =>
      estimateRetirementIncome({
        incomeJpy: 15_000_000,
        yearsOfService: 27,
        paymentYear: 2020,
        priorPayment: { paymentYear: 2023, kind: "REGULAR", overlappingYearsOfService: 6 },
      }),
    ).toThrow();
  });

  it("priorPaymentを指定してpaymentYearを省略するとエラーになる", () => {
    expect(() =>
      estimateRetirementIncome({
        incomeJpy: 15_000_000,
        yearsOfService: 27,
        priorPayment: { paymentYear: 2023, kind: "REGULAR", overlappingYearsOfService: 6 },
      }),
    ).toThrow();
  });

  it("重複する勤続年数が今回の勤続年数を超えるとエラーになる", () => {
    expect(() =>
      estimateRetirementIncome({
        incomeJpy: 15_000_000,
        yearsOfService: 10,
        paymentYear: 2026,
        priorPayment: { paymentYear: 2023, kind: "REGULAR", overlappingYearsOfService: 11 },
      }),
    ).toThrow();
  });
});
