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
 * 繰越控除限度超過額は`InvestmentLossCarryforward`(上場株式等の譲渡損失の
 * 繰越控除)と同様、発生年(originYear)ごとにDB(`ForeignTaxCreditCarryforward`)へ
 * 永続化し、発生年から3年以内のものだけを古い順に当年の限度額の余りへ充当する。
 */

const CARRYFORWARD_YEARS = 3;
const RECONSTRUCTION_SURTAX_RATE = 0.021;
// 住民税(道府県民税12%+市町村民税18%)の控除限度額は、所得税の控除限度額の30%
const RESIDENT_TAX_LIMIT_RATIO = 0.3;

export interface ForeignTaxCreditCarryforwardEntry {
  /** 控除限度超過額が発生した年(暦年) */
  originYear: number;
  /** 計算対象年の年初時点で残っている繰越控除可能な限度超過額 */
  remainingAmountJpy: Decimal.Value;
}

export interface ForeignTaxCreditCarryforwardUsage {
  originYear: number;
  usedAmountJpy: Decimal;
}

export interface ForeignTaxCreditCarryforwardExpiry {
  originYear: number;
  expiredAmountJpy: Decimal;
}

export interface ForeignTaxCreditCarryforwardBalance {
  originYear: number;
  remainingAmountJpy: Decimal;
}

export interface ForeignTaxCreditInput {
  /** 計算対象年(暦年)。繰越控除限度超過額の期限判定に使う */
  currentYear: number;
  /** その年分の所得税額(他の税額控除適用前、復興特別所得税を含まない) */
  incomeTaxJpy: Decimal.Value;
  /** その年分の所得税の計算の基礎となる所得総額(総所得金額等) */
  totalIncomeJpy: Decimal.Value;
  /** 国外所得金額(外国税額控除の対象となる、国外で生じた所得の金額) */
  foreignSourceIncomeJpy: Decimal.Value;
  /** その年に課された外国所得税額(日本円換算後の年間合計) */
  foreignIncomeTaxPaidJpy: Decimal.Value;
  /** 前年以前から繰り越された控除限度超過額(発生年ごと)。省略時は繰越無し */
  carryforwardEntries?: ForeignTaxCreditCarryforwardEntry[];
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
  /** 当年の限度額に余りがあり、繰越控除限度超過額の充当に使えた額(発生年ごとの内訳。古い順に充当) */
  usedCarryforwardByOriginYear: ForeignTaxCreditCarryforwardUsage[];
  /** 繰越控除限度超過額の充当額の合計 */
  creditFromCarryforwardJpy: Decimal;
  /** その年の確定申告で外国税額控除として使える合計額 */
  totalCreditJpy: Decimal;
  /** 当年新たに発生し、翌年以後3年間繰り越す控除限度超過額 */
  newExcessForeignTaxJpy: Decimal;
  /** 控除期限(発生年から3年)を過ぎて当年は使用できなかった繰越控除限度超過額 */
  expiredCarryforwardByOriginYear: ForeignTaxCreditCarryforwardExpiry[];
  /** 翌年に繰り越す控除限度超過額の残高(発生年ごと。当年新規発生分を含む) */
  carryforwardToNextYear: ForeignTaxCreditCarryforwardBalance[];
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

  requireNonNegative(incomeTaxJpy, "所得税額");
  requireNonNegative(totalIncomeJpy, "所得総額");
  requireNonNegative(foreignSourceIncomeJpy, "国外所得金額");
  requireNonNegative(foreignIncomeTaxPaidJpy, "外国所得税額");

  const currentYear = input.currentYear;
  const sortedEntries = (input.carryforwardEntries ?? [])
    .map((e) => ({
      originYear: e.originYear,
      remainingAmountJpy: new Decimal(e.remainingAmountJpy),
    }))
    .filter((e) => e.remainingAmountJpy.greaterThan(0))
    .sort((a, b) => a.originYear - b.originYear);

  for (const e of sortedEntries) {
    requireNonNegative(e.remainingAmountJpy, "繰越控除限度超過額");
  }

  const expiredCarryforwardByOriginYear: ForeignTaxCreditCarryforwardExpiry[] = [];
  const usableCarryforward: ForeignTaxCreditCarryforwardBalance[] = [];
  for (const e of sortedEntries) {
    // originYear の限度超過額は originYear+1 〜 originYear+3 の3年間のみ控除に使える
    if (currentYear > e.originYear + CARRYFORWARD_YEARS) {
      expiredCarryforwardByOriginYear.push({
        originYear: e.originYear,
        expiredAmountJpy: e.remainingAmountJpy,
      });
    } else {
      usableCarryforward.push(e);
    }
  }

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

  let remainingLimitJpy = totalLimitJpy.minus(creditFromCurrentYearJpy);
  const usedCarryforwardByOriginYear: ForeignTaxCreditCarryforwardUsage[] = [];
  const carryforwardToNextYear: ForeignTaxCreditCarryforwardBalance[] = [];

  for (const e of usableCarryforward) {
    if (remainingLimitJpy.isZero()) {
      carryforwardToNextYear.push(e);
      continue;
    }
    const used = Decimal.min(remainingLimitJpy, e.remainingAmountJpy);
    if (used.greaterThan(0)) {
      usedCarryforwardByOriginYear.push({ originYear: e.originYear, usedAmountJpy: used });
    }
    remainingLimitJpy = remainingLimitJpy.minus(used);
    const remaining = e.remainingAmountJpy.minus(used);
    if (remaining.greaterThan(0)) {
      carryforwardToNextYear.push({
        originYear: e.originYear,
        remainingAmountJpy: remaining,
      });
    }
  }

  const creditFromCarryforwardJpy = usedCarryforwardByOriginYear.reduce(
    (sum, u) => sum.plus(u.usedAmountJpy),
    new Decimal(0),
  );
  const totalCreditJpy = creditFromCurrentYearJpy.plus(creditFromCarryforwardJpy);

  if (newExcessForeignTaxJpy.greaterThan(0)) {
    carryforwardToNextYear.push({
      originYear: currentYear,
      remainingAmountJpy: newExcessForeignTaxJpy,
    });
  }

  return {
    incomeTaxLimitJpy,
    reconstructionSurtaxLimitJpy,
    residentTaxLimitJpy,
    totalLimitJpy,
    creditFromCurrentYearJpy,
    usedCarryforwardByOriginYear,
    creditFromCarryforwardJpy,
    totalCreditJpy,
    newExcessForeignTaxJpy,
    expiredCarryforwardByOriginYear,
    carryforwardToNextYear: carryforwardToNextYear.sort(
      (a, b) => a.originYear - b.originYear,
    ),
  };
}
