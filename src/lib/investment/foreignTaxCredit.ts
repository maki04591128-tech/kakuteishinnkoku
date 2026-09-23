import { Decimal } from "decimal.js";
import { prisma } from "../db";

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
 * 限度額が余った場合(控除余裕額)も翌年以後3年間繰り越せる。このモジュールは
 * 両方向の繰越を扱う。
 *  - 控除限度超過額(外国所得税額が限度額を超えた分)は、当年の限度額に余りが
 *    生じた将来の年でその余りに充当できる(`carryforwardEntries` /
 *    `usedCarryforwardByOriginYear` / `carryforwardToNextYear`)。
 *  - 控除余裕額(当年の限度額が外国所得税額を上回り余った分)は、外国所得税額が
 *    限度額を超えた将来の年でその超過額に充当できる(`spareLimitCarryforwardEntries` /
 *    `usedSpareLimitCarryforwardByOriginYear` / `spareLimitCarryforwardToNextYear`)。
 * 当年は「限度額が余る」か「限度額を超える」のいずれか一方しか起こらないため、
 * この2つの繰越が同じ年に同時に使われる・発生することはない。
 * いずれも`InvestmentLossCarryforward`(上場株式等の譲渡損失の繰越控除)と同様、
 * 発生年(originYear)ごとにDB(`ForeignTaxCreditCarryforward` /
 * `ForeignTaxCreditSpareLimitCarryforward`)へ永続化し、発生年から3年以内の
 * ものだけを古い順に充当する。
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

export interface ForeignTaxCreditSpareLimitEntry {
  /** 控除余裕額が発生した年(暦年) */
  originYear: number;
  /** 計算対象年の年初時点で残っている繰越可能な控除余裕額 */
  remainingAmountJpy: Decimal.Value;
}

export interface ForeignTaxCreditSpareLimitUsage {
  originYear: number;
  usedAmountJpy: Decimal;
}

export interface ForeignTaxCreditSpareLimitExpiry {
  originYear: number;
  expiredAmountJpy: Decimal;
}

export interface ForeignTaxCreditSpareLimitBalance {
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
  /** 前年以前から繰り越された控除余裕額(発生年ごと)。省略時は繰越無し */
  spareLimitCarryforwardEntries?: ForeignTaxCreditSpareLimitEntry[];
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
  /** 当年の外国所得税額が限度額を超え、繰越控除余裕額の充当に使えた額(発生年ごとの内訳。古い順に充当) */
  usedSpareLimitCarryforwardByOriginYear: ForeignTaxCreditSpareLimitUsage[];
  /** 繰越控除余裕額の充当額の合計 */
  creditFromSpareLimitCarryforwardJpy: Decimal;
  /** その年の確定申告で外国税額控除として使える合計額 */
  totalCreditJpy: Decimal;
  /** 当年新たに発生し、翌年以後3年間繰り越す控除限度超過額(繰越控除余裕額の充当後もなお控除しきれなかった額) */
  newExcessForeignTaxJpy: Decimal;
  /** 控除期限(発生年から3年)を過ぎて当年は使用できなかった繰越控除限度超過額 */
  expiredCarryforwardByOriginYear: ForeignTaxCreditCarryforwardExpiry[];
  /** 翌年に繰り越す控除限度超過額の残高(発生年ごと。当年新規発生分を含む) */
  carryforwardToNextYear: ForeignTaxCreditCarryforwardBalance[];
  /** 当年新たに発生し、翌年以後3年間繰り越す控除余裕額(当年の限度額のうち、繰越控除限度超過額への充当後もなお余った額) */
  newSpareLimitJpy: Decimal;
  /** 控除期限(発生年から3年)を過ぎて当年は使用できなかった繰越控除余裕額 */
  expiredSpareLimitCarryforwardByOriginYear: ForeignTaxCreditSpareLimitExpiry[];
  /** 翌年に繰り越す控除余裕額の残高(発生年ごと。当年新規発生分を含む) */
  spareLimitCarryforwardToNextYear: ForeignTaxCreditSpareLimitBalance[];
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

  const sortedSpareLimitEntries = (input.spareLimitCarryforwardEntries ?? [])
    .map((e) => ({
      originYear: e.originYear,
      remainingAmountJpy: new Decimal(e.remainingAmountJpy),
    }))
    .filter((e) => e.remainingAmountJpy.greaterThan(0))
    .sort((a, b) => a.originYear - b.originYear);

  for (const e of sortedSpareLimitEntries) {
    requireNonNegative(e.remainingAmountJpy, "繰越控除余裕額");
  }

  const expiredSpareLimitCarryforwardByOriginYear: ForeignTaxCreditSpareLimitExpiry[] = [];
  const usableSpareLimitCarryforward: ForeignTaxCreditSpareLimitBalance[] = [];
  for (const e of sortedSpareLimitEntries) {
    // originYear の控除余裕額は originYear+1 〜 originYear+3 の3年間のみ充当に使える
    if (currentYear > e.originYear + CARRYFORWARD_YEARS) {
      expiredSpareLimitCarryforwardByOriginYear.push({
        originYear: e.originYear,
        expiredAmountJpy: e.remainingAmountJpy,
      });
    } else {
      usableSpareLimitCarryforward.push(e);
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
  // 当年の限度額に対する外国所得税額の過不足。どちらか一方のみ発生し、両方が
  // 同時に正の値になることはない(限度額に余りがあれば超過は無く、その逆も同様)。
  let remainingExcessJpy = foreignIncomeTaxPaidJpy.minus(creditFromCurrentYearJpy);
  let remainingLimitJpy = totalLimitJpy.minus(creditFromCurrentYearJpy);

  // 限度額に余りがある場合、まず繰越控除限度超過額(古い年から)へ充当する
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

  // 外国所得税額が限度額を超える場合、繰越控除余裕額(古い年から)を充当する
  const usedSpareLimitCarryforwardByOriginYear: ForeignTaxCreditSpareLimitUsage[] = [];
  const spareLimitCarryforwardToNextYear: ForeignTaxCreditSpareLimitBalance[] = [];

  for (const e of usableSpareLimitCarryforward) {
    if (remainingExcessJpy.isZero()) {
      spareLimitCarryforwardToNextYear.push(e);
      continue;
    }
    const used = Decimal.min(remainingExcessJpy, e.remainingAmountJpy);
    if (used.greaterThan(0)) {
      usedSpareLimitCarryforwardByOriginYear.push({ originYear: e.originYear, usedAmountJpy: used });
    }
    remainingExcessJpy = remainingExcessJpy.minus(used);
    const remaining = e.remainingAmountJpy.minus(used);
    if (remaining.greaterThan(0)) {
      spareLimitCarryforwardToNextYear.push({
        originYear: e.originYear,
        remainingAmountJpy: remaining,
      });
    }
  }

  const creditFromCarryforwardJpy = usedCarryforwardByOriginYear.reduce(
    (sum, u) => sum.plus(u.usedAmountJpy),
    new Decimal(0),
  );
  const creditFromSpareLimitCarryforwardJpy = usedSpareLimitCarryforwardByOriginYear.reduce(
    (sum, u) => sum.plus(u.usedAmountJpy),
    new Decimal(0),
  );
  const totalCreditJpy = creditFromCurrentYearJpy
    .plus(creditFromCarryforwardJpy)
    .plus(creditFromSpareLimitCarryforwardJpy);

  // 控除余裕額の充当後もなお控除しきれなかった額が、翌年以後へ繰り越す新規の限度超過額
  const newExcessForeignTaxJpy = remainingExcessJpy;
  if (newExcessForeignTaxJpy.greaterThan(0)) {
    carryforwardToNextYear.push({
      originYear: currentYear,
      remainingAmountJpy: newExcessForeignTaxJpy,
    });
  }

  // 繰越控除限度超過額への充当後もなお余った当年の限度額が、翌年以後へ繰り越す新規の控除余裕額
  const newSpareLimitJpy = remainingLimitJpy;
  if (newSpareLimitJpy.greaterThan(0)) {
    spareLimitCarryforwardToNextYear.push({
      originYear: currentYear,
      remainingAmountJpy: newSpareLimitJpy,
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
    usedSpareLimitCarryforwardByOriginYear,
    creditFromSpareLimitCarryforwardJpy,
    totalCreditJpy,
    newExcessForeignTaxJpy,
    expiredCarryforwardByOriginYear,
    carryforwardToNextYear: carryforwardToNextYear.sort(
      (a, b) => a.originYear - b.originYear,
    ),
    newSpareLimitJpy,
    expiredSpareLimitCarryforwardByOriginYear,
    spareLimitCarryforwardToNextYear: spareLimitCarryforwardToNextYear.sort(
      (a, b) => a.originYear - b.originYear,
    ),
  };
}

export interface ForeignTaxCreditRecordEntry {
  taxYear: number;
  totalCreditJpy: Decimal;
}

/**
 * `/foreign-tax-credit`で登録済みの、指定した年分の外国税額控除の合計控除額を
 * DBから読み出す。下書きCSV(`/api/export`)の税額控除欄への自動反映に使う。
 * 未登録の年は null を返す。
 */
export async function getForeignTaxCreditRecord(
  year: number,
): Promise<ForeignTaxCreditRecordEntry | null> {
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (!taxYear) return null;

  const record = await prisma.foreignTaxCreditRecord.findUnique({
    where: { taxYearId: taxYear.id },
  });
  if (!record) return null;

  return {
    taxYear: year,
    totalCreditJpy: new Decimal(record.totalCreditJpy.toString()),
  };
}
