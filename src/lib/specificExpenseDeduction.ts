import { Decimal } from "decimal.js";

/**
 * 給与所得者の特定支出控除(所得税法57条の2)を試算する。
 *
 * 給与所得者本人が負担した「特定支出」の年間合計額が、給与所得控除額の1/2を
 * 超える場合、その超える部分の金額を給与所得控除に上乗せできる制度
 * (国税庁タックスアンサーNo.1415)。特定支出には次の6区分があり、いずれも
 * 給与の支払者から「特定支出に関する証明書」の交付を受けたものに限られる。
 *  - 通勤費
 *  - 転居費(転勤に伴うもの)
 *  - 研修費
 *  - 資格取得費(弁護士・公認会計士等の資格取得費用を含む。平成25年分以後)
 *  - 単身赴任者の帰宅旅費
 *  - 勤務必要経費(図書費・衣服費・交際費等。平成25年分以後追加。年間65万円が上限)
 *
 * 前提となる給与所得控除額(所得税法28条3項、令和2年分以後の速算表。国税庁
 * タックスアンサーNo.1410)は本ファイルの`employmentIncomeDeductionJpy`が
 * 計算する(他のファイルからも再利用する)。850万円超は195万円で頭打ち。
 * 子育て世帯等に対する所得金額調整控除(措置法41条の3の3。給与収入850万円超
 * 等が対象の別制度)は`src/lib/incomeAmountAdjustmentDeduction.ts`・
 * `/income-amount-adjustment-deduction`で試算できる。
 *
 * 簡略化している点:
 *  - 実務上の給与所得控除額は「年末調整等のための給与所得控除後の給与等の
 *    金額の表」による1円未満の端数処理があるが、本ツールは速算式の計算結果を
 *    そのまま使う概算値。
 *  - 特定支出各区分の該当性(証明書の要件を満たすか等)の判定はユーザー自身が
 *    行う前提で、本ツールは金額の合計と控除額の計算のみを担う。
 */

export interface SpecificExpenseDeductionInput {
  /** その年の給与収入金額 */
  salaryIncomeJpy: Decimal.Value;
  /** 通勤費 */
  commutingExpenseJpy: Decimal.Value;
  /** 転居費(転勤に伴うもの) */
  relocationExpenseJpy: Decimal.Value;
  /** 研修費 */
  trainingExpenseJpy: Decimal.Value;
  /** 資格取得費 */
  qualificationExpenseJpy: Decimal.Value;
  /** 単身赴任者の帰宅旅費 */
  returningHomeExpenseJpy: Decimal.Value;
  /** 勤務必要経費(図書費・衣服費・交際費等。年間65万円が上限) */
  jobRelatedExpenseJpy: Decimal.Value;
}

export interface SpecificExpenseDeductionResult {
  salaryIncomeJpy: Decimal;
  /** 給与所得控除額(速算表による概算) */
  employmentIncomeDeductionJpy: Decimal;
  /** 特定支出控除の適用判定基準額(給与所得控除額の1/2) */
  thresholdJpy: Decimal;
  /** 勤務必要経費(65万円の上限適用後) */
  cappedJobRelatedExpenseJpy: Decimal;
  /** 特定支出の合計額(勤務必要経費は上限適用後) */
  totalSpecificExpenseJpy: Decimal;
  /** 特定支出控除額(特定支出の合計額が基準額を超える部分) */
  specificExpenseDeductionJpy: Decimal;
  /** 特定支出控除適用後の給与所得金額(0円が下限) */
  adjustedEmploymentIncomeJpy: Decimal;
  notes: string[];
}

/** 勤務必要経費(図書費・衣服費・交際費等)の年間上限額 */
const JOB_RELATED_EXPENSE_MAX_JPY = new Decimal(650_000);

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

/**
 * 給与所得控除額の速算表(所得税法28条3項、令和2年分以後。国税庁タックス
 * アンサーNo.1410)。給与所得控除額が収入金額を超えて所得がマイナスになる
 * ことは無いよう、収入金額自体を上限としてクランプする。
 */
export function employmentIncomeDeductionJpy(salaryIncomeJpy: Decimal.Value): Decimal {
  const income = new Decimal(salaryIncomeJpy);
  requireNonNegative(income, "給与収入金額");

  let deduction: Decimal;
  if (income.lessThanOrEqualTo(1_625_000)) {
    deduction = new Decimal(550_000);
  } else if (income.lessThanOrEqualTo(1_800_000)) {
    deduction = income.times(0.4).minus(100_000);
  } else if (income.lessThanOrEqualTo(3_600_000)) {
    deduction = income.times(0.3).plus(80_000);
  } else if (income.lessThanOrEqualTo(6_600_000)) {
    deduction = income.times(0.2).plus(440_000);
  } else if (income.lessThanOrEqualTo(8_500_000)) {
    deduction = income.times(0.1).plus(1_100_000);
  } else {
    deduction = new Decimal(1_950_000);
  }

  return Decimal.min(deduction, income);
}

export function estimateSpecificExpenseDeduction(
  input: SpecificExpenseDeductionInput,
): SpecificExpenseDeductionResult {
  const salaryIncomeJpy = new Decimal(input.salaryIncomeJpy);
  const commutingExpenseJpy = new Decimal(input.commutingExpenseJpy);
  const relocationExpenseJpy = new Decimal(input.relocationExpenseJpy);
  const trainingExpenseJpy = new Decimal(input.trainingExpenseJpy);
  const qualificationExpenseJpy = new Decimal(input.qualificationExpenseJpy);
  const returningHomeExpenseJpy = new Decimal(input.returningHomeExpenseJpy);
  const jobRelatedExpenseJpy = new Decimal(input.jobRelatedExpenseJpy);

  requireNonNegative(salaryIncomeJpy, "給与収入金額");
  requireNonNegative(commutingExpenseJpy, "通勤費");
  requireNonNegative(relocationExpenseJpy, "転居費");
  requireNonNegative(trainingExpenseJpy, "研修費");
  requireNonNegative(qualificationExpenseJpy, "資格取得費");
  requireNonNegative(returningHomeExpenseJpy, "単身赴任者の帰宅旅費");
  requireNonNegative(jobRelatedExpenseJpy, "勤務必要経費");

  const cappedJobRelatedExpenseJpy = Decimal.min(jobRelatedExpenseJpy, JOB_RELATED_EXPENSE_MAX_JPY);

  const totalSpecificExpenseJpy = commutingExpenseJpy
    .plus(relocationExpenseJpy)
    .plus(trainingExpenseJpy)
    .plus(qualificationExpenseJpy)
    .plus(returningHomeExpenseJpy)
    .plus(cappedJobRelatedExpenseJpy);

  const employmentDeduction = employmentIncomeDeductionJpy(salaryIncomeJpy);
  const thresholdJpy = employmentDeduction.dividedBy(2);

  const specificExpenseDeductionJpy = Decimal.max(0, totalSpecificExpenseJpy.minus(thresholdJpy));

  const adjustedEmploymentIncomeJpy = Decimal.max(
    0,
    salaryIncomeJpy.minus(employmentDeduction).minus(specificExpenseDeductionJpy),
  );

  const notes: string[] = [
    "給与の支払者から「特定支出に関する証明書」の交付を受けた特定支出のみが対象(国税庁タックスアンサーNo.1415)。証明書が無い支出は含めないこと。",
    "勤務必要経費(図書費・衣服費・交際費等)は年間65万円が上限(上限超過分は特定支出の合計額に算入しない)。",
    "給与所得控除額は速算表による概算値。実際の申告では「給与所得控除後の給与等の金額の表」の1円単位の値と若干異なる場合がある。",
    "子育て世帯等に対する所得金額調整控除(措置法41条の3の3。給与収入850万円超等が対象)は別制度のため本試算には含まれない(/income-amount-adjustment-deductionで試算)。",
  ];

  return {
    salaryIncomeJpy,
    employmentIncomeDeductionJpy: employmentDeduction,
    thresholdJpy,
    cappedJobRelatedExpenseJpy,
    totalSpecificExpenseJpy,
    specificExpenseDeductionJpy,
    adjustedEmploymentIncomeJpy,
    notes,
  };
}
