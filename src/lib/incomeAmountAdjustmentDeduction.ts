import { Decimal } from "decimal.js";
import { employmentIncomeDeductionJpy } from "./specificExpenseDeduction";

/**
 * 所得金額調整控除(租税特別措置法41条の3の3。国税庁タックスアンサーNo.1411)を
 * 試算する。令和2年分(2020年分)の給与所得控除の上限引き下げ(850万円超は
 * 195万円で頭打ち。`employmentIncomeDeductionJpy`参照)にあわせて新設された、
 * 給与所得の計算上の調整控除。次の2種類があり、両方に該当する場合は併用できる。
 *
 * **①子育て・特別障害者等の所得金額調整控除:**
 * その年の給与収入金額が850万円を超え、かつ次のいずれかに該当する場合が対象。
 *  - 納税者本人が特別障害者
 *  - 特別障害者である同一生計配偶者または扶養親族を有する
 *  - 年齢23歳未満の扶養親族を有する
 * 控除額 = (給与収入金額(1,000万円が上限) − 850万円) × 10%(最大15万円)。
 * 給与所得金額から控除する(所得税・住民税で同額)。
 *
 * **②給与所得と公的年金等に係る雑所得の双方がある者に対する所得金額調整控除:**
 * その年に給与所得と公的年金等に係る雑所得の両方があり、その合計額が10万円を
 * 超える場合が対象(①と異なり給与収入額そのものの下限は無い)。
 * 控除額 = min(給与所得金額, 10万円) + min(公的年金等に係る雑所得の金額, 10万円) − 10万円。
 * ①・②の両方に該当する場合、国税庁の説明では①を先に給与所得から控除した後の
 * 金額を②の「給与所得金額」として用いる(本ファイルもこの順序で計算する)。
 *
 * いずれも所得税法上は「所得控除」ではなく給与所得の計算上の控除(申告書
 * 第一表の給与所得金額欄に反映)である点は特定支出控除(機能63)と同様。
 */

export interface IncomeAmountAdjustmentDeductionInput {
  /**
   * 課税年分(西暦)。給与所得控除の最低保障額の引上げを`employmentIncomeDeductionJpy`に
   * 反映するために使う(詳細は`src/lib/specificExpenseDeduction.ts`参照)。省略時は
   * 令和6年分以前(最低保障額55万円)を適用する。
   */
  year?: number;
  /** その年の給与収入金額 */
  salaryIncomeJpy: Decimal.Value;
  /** 納税者本人が特別障害者に該当するか(①の要件) */
  isTaxpayerSpecialDisability: boolean;
  /** 特別障害者に該当する同一生計配偶者・扶養親族がいるか(①の要件) */
  hasSpecialDisabilityDependentOrSpouse: boolean;
  /** 年齢23歳未満の扶養親族がいるか(①の要件) */
  hasDependentUnder23: boolean;
  /** 公的年金等に係る雑所得の金額(②の要件・所得ベース。無ければ0) */
  publicPensionMiscIncomeJpy: Decimal.Value;
}

export interface IncomeAmountAdjustmentDeductionResult {
  salaryIncomeJpy: Decimal;
  /** 給与所得控除額(速算表による概算) */
  employmentIncomeDeductionJpy: Decimal;
  /** 調整前の給与所得金額 */
  employmentIncomeBeforeAdjustmentJpy: Decimal;
  /** ①子育て・特別障害者等の所得金額調整控除に該当するか */
  isEligibleForChildOrDisabilityAdjustment: boolean;
  /** ①の控除額 */
  childOrDisabilityAdjustmentJpy: Decimal;
  /** ①適用後の給与所得金額 */
  employmentIncomeAfterChildOrDisabilityAdjustmentJpy: Decimal;
  /** ②給与所得・年金雑所得双方がある者に対する所得金額調整控除に該当するか */
  isEligibleForPensionAdjustment: boolean;
  /** ②の控除額 */
  pensionAdjustmentJpy: Decimal;
  /** 所得金額調整控除の合計額(①+②) */
  totalDeductionJpy: Decimal;
  /** 所得金額調整控除適用後の給与所得金額(0円が下限) */
  adjustedEmploymentIncomeJpy: Decimal;
  notes: string[];
}

/** ①の対象となる給与収入金額の下限 */
const CHILD_OR_DISABILITY_THRESHOLD_JPY = new Decimal(8_500_000);
/** ①の控除額算定にあたっての給与収入金額の上限(この上限により控除額は15万円で頭打ちになる) */
const CHILD_OR_DISABILITY_INCOME_CAP_JPY = new Decimal(10_000_000);
/** ②の各所得の上限額・控除額算定に用いる定額 */
const PENSION_ADJUSTMENT_CAP_JPY = new Decimal(100_000);

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateIncomeAmountAdjustmentDeduction(
  input: IncomeAmountAdjustmentDeductionInput,
): IncomeAmountAdjustmentDeductionResult {
  const salaryIncomeJpy = new Decimal(input.salaryIncomeJpy);
  const publicPensionMiscIncomeJpy = new Decimal(input.publicPensionMiscIncomeJpy);

  requireNonNegative(salaryIncomeJpy, "給与収入金額");
  requireNonNegative(publicPensionMiscIncomeJpy, "公的年金等に係る雑所得の金額");

  const employmentIncomeDeduction = employmentIncomeDeductionJpy(salaryIncomeJpy, input.year);
  const employmentIncomeBeforeAdjustmentJpy = salaryIncomeJpy.minus(employmentIncomeDeduction);

  const isEligibleForChildOrDisabilityAdjustment =
    salaryIncomeJpy.greaterThan(CHILD_OR_DISABILITY_THRESHOLD_JPY) &&
    (input.isTaxpayerSpecialDisability ||
      input.hasSpecialDisabilityDependentOrSpouse ||
      input.hasDependentUnder23);

  const childOrDisabilityAdjustmentJpy = isEligibleForChildOrDisabilityAdjustment
    ? Decimal.min(salaryIncomeJpy, CHILD_OR_DISABILITY_INCOME_CAP_JPY)
        .minus(CHILD_OR_DISABILITY_THRESHOLD_JPY)
        .times(0.1)
    : new Decimal(0);

  const employmentIncomeAfterChildOrDisabilityAdjustmentJpy = Decimal.max(
    0,
    employmentIncomeBeforeAdjustmentJpy.minus(childOrDisabilityAdjustmentJpy),
  );

  const isEligibleForPensionAdjustment =
    employmentIncomeAfterChildOrDisabilityAdjustmentJpy.greaterThan(0) &&
    publicPensionMiscIncomeJpy.greaterThan(0) &&
    employmentIncomeAfterChildOrDisabilityAdjustmentJpy
      .plus(publicPensionMiscIncomeJpy)
      .greaterThan(PENSION_ADJUSTMENT_CAP_JPY);

  const pensionAdjustmentJpy = isEligibleForPensionAdjustment
    ? Decimal.min(employmentIncomeAfterChildOrDisabilityAdjustmentJpy, PENSION_ADJUSTMENT_CAP_JPY)
        .plus(Decimal.min(publicPensionMiscIncomeJpy, PENSION_ADJUSTMENT_CAP_JPY))
        .minus(PENSION_ADJUSTMENT_CAP_JPY)
    : new Decimal(0);

  const totalDeductionJpy = childOrDisabilityAdjustmentJpy.plus(pensionAdjustmentJpy);

  const adjustedEmploymentIncomeJpy = Decimal.max(
    0,
    employmentIncomeAfterChildOrDisabilityAdjustmentJpy.minus(pensionAdjustmentJpy),
  );

  const notes: string[] = [
    "所得税法上は「所得控除」ではなく給与所得の計算上の控除(申告書第一表の給与所得金額欄に反映)だが、本ツールでは他の所得控除と同様に合算して試算する簡略化としている(特定支出控除と同様)。",
    "①(子育て・特別障害者等)の対象となる特別障害者・扶養親族(23歳未満)の該当性判定自体はユーザー自身が行う前提とする。",
    "②(給与所得・公的年金等雑所得の双方がある者)の給与所得金額は、①が適用される場合はその適用後の金額を用いる(両方に該当する場合の国税庁の取扱いに基づく)。",
    "給与所得控除額は速算表による概算値。実際の申告では「給与所得控除後の給与等の金額の表」の1円単位の値と若干異なる場合がある。",
    "給与所得控除の最低保障額は令和7年分65万円・令和8年分及び令和9年分74万円・令和10年分以後69万円へ段階的に引き上げられている(課税年分を指定していない場合は引上げ前の55万円を適用)。",
  ];

  return {
    salaryIncomeJpy,
    employmentIncomeDeductionJpy: employmentIncomeDeduction,
    employmentIncomeBeforeAdjustmentJpy,
    isEligibleForChildOrDisabilityAdjustment,
    childOrDisabilityAdjustmentJpy,
    employmentIncomeAfterChildOrDisabilityAdjustmentJpy,
    isEligibleForPensionAdjustment,
    pensionAdjustmentJpy,
    totalDeductionJpy,
    adjustedEmploymentIncomeJpy,
    notes,
  };
}
