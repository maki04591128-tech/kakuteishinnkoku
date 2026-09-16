import { Decimal } from "decimal.js";

/**
 * 外国税額控除(所得税法95条)。
 *
 * 米国株式等、国外で発行された株式・投資信託の配当等は、日本での課税
 * (申告分離課税20.315%等)に加えて、現地国でも源泉徴収されることが多い
 * (米国株の場合、租税条約により10%が一般的)。この二重課税を調整するのが
 * 外国税額控除で、外国で課された所得税額を、一定の限度額の範囲内で
 * その年分の所得税額・復興特別所得税額・住民税額から控除できる。
 *
 * 控除限度額は次の順に計算する(国税庁タックスアンサーNo.1240に基づく)。
 *  1. 所得税の控除限度額 = その年分の所得税額 × (調整国外所得金額 ÷ 所得総額)
 *     (調整国外所得金額は国外所得金額が所得総額を超える場合、所得総額が上限)
 *  2. 復興特別所得税の控除限度額 = 復興特別所得税額 × 同じ割合
 *     (=所得税の控除限度額 × 2.1%と同値。復興特別所得税額自体が所得税額×2.1%のため)
 *  3. 住民税(道府県民税・市町村民税)の控除限度額 = 所得税の控除限度額 × 30%
 *     (内訳: 道府県民税12%+市町村民税18%。地方税法の定める標準の割合)
 * 当年の外国所得税額は、まずこの3つの限度額の合計から控除する。
 *
 * 控除しきれない外国所得税額(控除限度超過額)は翌年以後3年間、また当年
 * 限度額が余った場合(控除余裕額)も翌年以後3年間繰り越せるが、このモジュールは
 * 限度超過額側の繰越のみを扱う(余裕額側の繰越は今後の課題。ロードマップ参照)。
 * 繰越額は発生年ごとの3年以内という期限管理をこのモジュールでは行わず、
 * 呼び出し側が繰り越す残高を単純な合計値として渡す簡略化とした
 * (上場株式等の譲渡損失の繰越控除のような発生年ごとの自動繰越・期限切れ管理は
 * 今後の課題)。
 */

const RECONSTRUCTION_SURTAX_RATE = 0.021;
// 住民税(道府県民税12%+市町村民税18%)の控除限度額は、所得税の控除限度額の30%
const RESIDENT_TAX_LIMIT_RATIO = 0.3;

export interface ForeignTaxCreditInput {
  /** その年分の所得税額(他の税額控除適用前、復興特別所得税を含まない) */
  incomeTaxJpy: Decimal.Value;
  /** その年分の所得税の計算の基礎となる所得総額(総所得金額等) */
  totalIncomeJpy: Decimal.Value;
  /** 国外所得金額(外国税額控除の対象となる、国外で生じた所得の金額) */
  foreignSourceIncomeJpy: Decimal.Value;
  /** その年に課された外国所得税額(日本円換算後の年間合計) */
  foreignIncomeTaxPaidJpy: Decimal.Value;
  /** 前年以前3年以内から繰り越された控除限度超過額の残高(合計値、手入力)。省略時は0 */
  carriedForwardExcessForeignTaxJpy?: Decimal.Value;
}

export interface ForeignTaxCreditResult {
  /** 所得税の控除限度額 */
  incomeTaxLimitJpy: Decimal;
  /** 復興特別所得税の控除限度額 */
  reconstructionSurtaxLimitJpy: Decimal;
  /** 住民税の控除限度額(概算・30%固定) */
  residentTaxLimitJpy: Decimal;
  /** 合計控除限度額 */
  totalLimitJpy: Decimal;
  /** 当年発生分の外国所得税額のうち、当年の限度額から控除できた額 */
  creditFromCurrentYearJpy: Decimal;
  /** 当年の限度額に余りがあり、繰越控除限度超過額の充当に使えた額 */
  creditFromCarryforwardJpy: Decimal;
  /** その年の確定申告で外国税額控除として使える合計額 */
  totalCreditJpy: Decimal;
  /** 当年新たに発生し、翌年以後3年間繰り越す控除限度超過額 */
  newExcessForeignTaxJpy: Decimal;
  /** 繰り越されてきた控除限度超過額のうち、当年使い切れず残った額(引き続き繰越) */
  unusedCarriedForwardExcessJpy: Decimal;
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

/**
 * 外国税額控除の控除限度額・控除額を計算する。DBに依存しない純粋関数。
 */
export function calculateForeignTaxCredit(
  input: ForeignTaxCreditInput,
): ForeignTaxCreditResult {
  const incomeTaxJpy = new Decimal(input.incomeTaxJpy);
  const totalIncomeJpy = new Decimal(input.totalIncomeJpy);
  const foreignSourceIncomeJpy = new Decimal(input.foreignSourceIncomeJpy);
  const foreignIncomeTaxPaidJpy = new Decimal(input.foreignIncomeTaxPaidJpy);
  const carriedForwardExcessForeignTaxJpy = input.carriedForwardExcessForeignTaxJpy
    ? new Decimal(input.carriedForwardExcessForeignTaxJpy)
    : new Decimal(0);

  requireNonNegative(incomeTaxJpy, "所得税額");
  requireNonNegative(totalIncomeJpy, "所得総額");
  requireNonNegative(foreignSourceIncomeJpy, "国外所得金額");
  requireNonNegative(foreignIncomeTaxPaidJpy, "外国所得税額");
  requireNonNegative(carriedForwardExcessForeignTaxJpy, "繰越控除限度超過額");

  // 調整国外所得金額は所得総額を上限とする
  const adjustedForeignSourceIncomeJpy = Decimal.min(foreignSourceIncomeJpy, totalIncomeJpy);
  const ratio = totalIncomeJpy.isZero()
    ? new Decimal(0)
    : adjustedForeignSourceIncomeJpy.dividedBy(totalIncomeJpy);

  const incomeTaxLimitJpy = incomeTaxJpy.times(ratio);
  const reconstructionSurtaxLimitJpy = incomeTaxLimitJpy.times(RECONSTRUCTION_SURTAX_RATE);
  const residentTaxLimitJpy = incomeTaxLimitJpy.times(RESIDENT_TAX_LIMIT_RATIO);
  const totalLimitJpy = incomeTaxLimitJpy
    .plus(reconstructionSurtaxLimitJpy)
    .plus(residentTaxLimitJpy);

  const creditFromCurrentYearJpy = Decimal.min(foreignIncomeTaxPaidJpy, totalLimitJpy);
  const newExcessForeignTaxJpy = foreignIncomeTaxPaidJpy.minus(creditFromCurrentYearJpy);

  const remainingLimitJpy = totalLimitJpy.minus(creditFromCurrentYearJpy);
  const creditFromCarryforwardJpy = Decimal.min(
    carriedForwardExcessForeignTaxJpy,
    remainingLimitJpy,
  );
  const unusedCarriedForwardExcessJpy = carriedForwardExcessForeignTaxJpy.minus(
    creditFromCarryforwardJpy,
  );

  const totalCreditJpy = creditFromCurrentYearJpy.plus(creditFromCarryforwardJpy);

  return {
    incomeTaxLimitJpy,
    reconstructionSurtaxLimitJpy,
    residentTaxLimitJpy,
    totalLimitJpy,
    creditFromCurrentYearJpy,
    creditFromCarryforwardJpy,
    totalCreditJpy,
    newExcessForeignTaxJpy,
    unusedCarriedForwardExcessJpy,
  };
}
