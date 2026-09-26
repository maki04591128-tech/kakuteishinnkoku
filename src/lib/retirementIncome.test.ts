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
      priorPayments: [{ paymentYear: 2023, kind: "REGULAR", overlappingYearsOfService: 6 }],
    });
    expect(result.overlapDeductionReductionJpy.toNumber()).toBe(2_400_000);
    expect(result.deductionJpy.toNumber()).toBe(10_500_000);
  });

  it("重複する勤続年数の端数は切り捨てる", () => {
    const result = estimateRetirementIncome({
      incomeJpy: 15_000_000,
      yearsOfService: 27,
      paymentYear: 2026,
      priorPayments: [{ paymentYear: 2023, kind: "REGULAR", overlappingYearsOfService: 6.9 }],
    });
    // 6.9年→6年 → 40万円×6年=240万円(7年扱いにはならない)
    expect(result.overlapDeductionReductionJpy.toNumber()).toBe(2_400_000);
  });

  it("前の退職手当等が対象期間(前年以前4年内)より前なら重複排除は適用しない", () => {
    const result = estimateRetirementIncome({
      incomeJpy: 15_000_000,
      yearsOfService: 27,
      paymentYear: 2026,
      priorPayments: [{ paymentYear: 2020, kind: "REGULAR", overlappingYearsOfService: 6 }],
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
      priorPayments: [{ paymentYear: 2010, kind: "REGULAR", overlappingYearsOfService: 10 }],
    });
    // 通常の控除額: 40万円×20年=800万円、重複排除: 40万円×10年=400万円 → 400万円
    expect(result.deductionJpy.toNumber()).toBe(4_000_000);
  });

  it("前が令和8年以後支給のDC一時金なら前年以前9年内(改正前は4年内)が重複排除の対象になる", () => {
    const result = estimateRetirementIncome({
      incomeJpy: 15_000_000,
      yearsOfService: 27,
      paymentYear: 2036,
      priorPayments: [{ paymentYear: 2030, kind: "DC_LUMP_SUM", overlappingYearsOfService: 6 }],
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
      priorPayments: [{ paymentYear: 2025, kind: "DC_LUMP_SUM", overlappingYearsOfService: 6 }],
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
        priorPayments: [{ paymentYear: 2023, kind: "REGULAR", overlappingYearsOfService: 6 }],
      }),
    ).toThrow();
  });

  it("priorPaymentsを指定してpaymentYearを省略するとエラーになる", () => {
    expect(() =>
      estimateRetirementIncome({
        incomeJpy: 15_000_000,
        yearsOfService: 27,
        priorPayments: [{ paymentYear: 2023, kind: "REGULAR", overlappingYearsOfService: 6 }],
      }),
    ).toThrow();
  });

  it("重複する勤続年数が今回の勤続年数を超えるとエラーになる", () => {
    expect(() =>
      estimateRetirementIncome({
        incomeJpy: 15_000_000,
        yearsOfService: 10,
        paymentYear: 2026,
        priorPayments: [{ paymentYear: 2023, kind: "REGULAR", overlappingYearsOfService: 11 }],
      }),
    ).toThrow();
  });
});

describe("estimateRetirementIncome の重複排除(前の退職手当等が2件以上。機能109)", () => {
  it("対象期間内の複数件の重複勤続年数を合計して控除額を1回で計算する", () => {
    // 勤続27年・退職金1,500万円、B社(2023年、3年重複)・C社(2024年、2年重複)がいずれも対象期間(4年内)内
    // 通常の控除額: 800万円+70万円×(27-20)=1,290万円、重複排除: 40万円×(3+2)=200万円 → 1,090万円
    const result = estimateRetirementIncome({
      incomeJpy: 15_000_000,
      yearsOfService: 27,
      paymentYear: 2026,
      priorPayments: [
        { paymentYear: 2023, kind: "REGULAR", overlappingYearsOfService: 3 },
        { paymentYear: 2024, kind: "REGULAR", overlappingYearsOfService: 2 },
      ],
    });
    expect(result.overlapDeductionReductionJpy.toNumber()).toBe(2_000_000);
    expect(result.deductionJpy.toNumber()).toBe(10_900_000);
  });

  it("対象期間外の件は合計から除外する", () => {
    // B社(2020年、7年前)は対象期間(4年内)外のため除外、C社(2024年、2年重複)のみ対象
    const result = estimateRetirementIncome({
      incomeJpy: 15_000_000,
      yearsOfService: 27,
      paymentYear: 2026,
      priorPayments: [
        { paymentYear: 2020, kind: "REGULAR", overlappingYearsOfService: 6 },
        { paymentYear: 2024, kind: "REGULAR", overlappingYearsOfService: 2 },
      ],
    });
    expect(result.overlapDeductionReductionJpy.toNumber()).toBe(800_000);
  });

  it("重複勤続年数の合計が今回の勤続年数を超える場合は今回の勤続年数を上限とする", () => {
    // 勤続10年に対しB社8年重複・C社5年重複(合計13年)は勤続年数10年を超えるため10年を上限とする
    const result = estimateRetirementIncome({
      incomeJpy: 15_000_000,
      yearsOfService: 10,
      paymentYear: 2026,
      priorPayments: [
        { paymentYear: 2023, kind: "REGULAR", overlappingYearsOfService: 8 },
        { paymentYear: 2024, kind: "REGULAR", overlappingYearsOfService: 5 },
      ],
    });
    // 控除額(40万円×10年=400万円)を上限に重複排除するため、控除後の退職所得控除額は0円
    expect(result.overlapDeductionReductionJpy.toNumber()).toBe(4_000_000);
    expect(result.deductionJpy.toNumber()).toBe(0);
  });

  it("各件ごとに異なる重複排除対象期間(DC一時金)を判定する", () => {
    // 今回は通常の退職手当等。B社(2010年、DC一時金、10年重複)は19年内ではなく
    // 通常同士の対象期間(4年内)で判定され対象外、C社(2024年、通常、2年重複)のみ対象
    const result = estimateRetirementIncome({
      incomeJpy: 15_000_000,
      yearsOfService: 27,
      paymentYear: 2026,
      priorPayments: [
        { paymentYear: 2010, kind: "DC_LUMP_SUM", overlappingYearsOfService: 10 },
        { paymentYear: 2024, kind: "REGULAR", overlappingYearsOfService: 2 },
      ],
    });
    expect(result.overlapDeductionReductionJpy.toNumber()).toBe(800_000);
  });
});

describe("estimateRetirementIncome の同一年中の合算(国税庁タックスアンサーNo.2735)", () => {
  it("重複する勤続期間がない場合、収入金額と勤続年数を単純に合算する", () => {
    // 勤続20年・退職金1,000万円(控除額800万円)とA社勤続5年・退職金300万円(重複なし)を合算
    // 合算勤続年数=25年、合算収入=1,300万円、控除額=800万円+70万円×5年=1,150万円
    // (1,300万円-1,150万円)×1/2=75万円
    const result = estimateRetirementIncome({
      incomeJpy: 10_000_000,
      yearsOfService: 20,
      samePeriodPayments: [{ incomeJpy: 3_000_000, yearsOfService: 5, overlappingYearsOfService: 0 }],
    });
    expect(result.combinedIncomeJpy.toNumber()).toBe(13_000_000);
    expect(result.combinedYearsOfService).toBe(25);
    expect(result.deductionJpy.toNumber()).toBe(11_500_000);
    expect(result.retirementIncomeJpy.toNumber()).toBe(750_000);
  });

  it("勤続期間が完全に重複する場合、長い方の勤続年数のみで計算する", () => {
    // 勤続10年・退職金500万円と、同じ10年間ずっと在籍していたB社・退職金200万円(完全重複)
    // 合算勤続年数=10年(重複分は加算しない)、合算収入=700万円、控除額=40万円×10年=400万円
    const result = estimateRetirementIncome({
      incomeJpy: 5_000_000,
      yearsOfService: 10,
      samePeriodPayments: [{ incomeJpy: 2_000_000, yearsOfService: 10, overlappingYearsOfService: 10 }],
    });
    expect(result.combinedYearsOfService).toBe(10);
    expect(result.combinedIncomeJpy.toNumber()).toBe(7_000_000);
    expect(result.deductionJpy.toNumber()).toBe(4_000_000);
  });

  it("重複しない部分のみ勤続年数に加算する(端数切り捨て)", () => {
    // 勤続20年・B社勤続8年のうち6.9年が重複 → 非重複分は8-6(切り捨て)=2年を加算
    const result = estimateRetirementIncome({
      incomeJpy: 10_000_000,
      yearsOfService: 20,
      samePeriodPayments: [{ incomeJpy: 1_000_000, yearsOfService: 8, overlappingYearsOfService: 6.9 }],
    });
    expect(result.combinedYearsOfService).toBe(22);
  });

  it("複数の同一年中の退職手当等を順に合算できる", () => {
    // 主たる勤続15年 + A社勤続5年(重複なし) + B社勤続3年(Aとの合算後に2年重複)
    // 合算勤続年数=15+5+(3-2)=21年
    const result = estimateRetirementIncome({
      incomeJpy: 5_000_000,
      yearsOfService: 15,
      samePeriodPayments: [
        { incomeJpy: 1_000_000, yearsOfService: 5, overlappingYearsOfService: 0 },
        { incomeJpy: 1_000_000, yearsOfService: 3, overlappingYearsOfService: 2 },
      ],
    });
    expect(result.combinedYearsOfService).toBe(21);
    expect(result.combinedIncomeJpy.toNumber()).toBe(7_000_000);
  });

  it("同一年中の合算と前年以前の重複排除を併用できる", () => {
    // 合算勤続年数=20+5=25年、合算収入=1,300万円、通常の控除額=800万円+70万円×5年=1,150万円
    // 前年以前の重複排除(4年分)で控除額から40万円×4年=160万円を差し引き、控除額=990万円
    const result = estimateRetirementIncome({
      incomeJpy: 10_000_000,
      yearsOfService: 20,
      paymentYear: 2026,
      samePeriodPayments: [{ incomeJpy: 3_000_000, yearsOfService: 5, overlappingYearsOfService: 0 }],
      priorPayments: [{ paymentYear: 2024, kind: "REGULAR", overlappingYearsOfService: 4 }],
    });
    expect(result.combinedYearsOfService).toBe(25);
    expect(result.overlapDeductionReductionJpy.toNumber()).toBe(1_600_000);
    expect(result.deductionJpy.toNumber()).toBe(9_900_000);
  });

  it("同一年中の他の退職手当等の収入金額が負の値だとエラーになる", () => {
    expect(() =>
      estimateRetirementIncome({
        incomeJpy: 5_000_000,
        yearsOfService: 10,
        samePeriodPayments: [{ incomeJpy: -1, yearsOfService: 5, overlappingYearsOfService: 0 }],
      }),
    ).toThrow();
  });

  it("同一年中の他の退職手当等と重複する勤続年数がその勤続年数を超えるとエラーになる", () => {
    expect(() =>
      estimateRetirementIncome({
        incomeJpy: 5_000_000,
        yearsOfService: 10,
        samePeriodPayments: [{ incomeJpy: 1_000_000, yearsOfService: 5, overlappingYearsOfService: 6 }],
      }),
    ).toThrow();
  });

  it("samePeriodPaymentsを指定しない場合は従来どおり単独の収入金額・勤続年数で計算する", () => {
    const result = estimateRetirementIncome({ incomeJpy: 20_000_000, yearsOfService: 30 });
    expect(result.combinedIncomeJpy.toNumber()).toBe(20_000_000);
    expect(result.combinedYearsOfService).toBe(30);
  });
});
