import { Decimal } from "decimal.js";
import { RECONSTRUCTION_SURTAX_RATE } from "./incomeTax";

/**
 * 寄附金控除(所得税法78条・地方税法37条の2等)の実額試算。
 *
 * `furusatoNozei.ts`の`estimateFurusatoNozeiLimit`が「自己負担2,000円のままに
 * なる年間寄附上限額」の目安を求めるのに対し、こちらは実際に支払った(または
 * 支払う予定の)寄附金額を入力して、所得税・住民税それぞれの控除額そのものを
 * 試算する。
 *
 * 計算式:
 *  - 所得税の寄附金控除額
 *      = min(寄附金の合計額, 総所得金額等 × 40%) − 2,000円(下限0円)
 *  - 住民税の基本控除額(道府県民税4%+市区町村民税6%の合計)
 *      = (min(寄附金の合計額, 総所得金額等 × 30%) − 2,000円) × 10%(下限0円)
 *  - 住民税の特例控除額(ふるさと納税=都道府県・市区町村への寄附分のみ)
 *      = (ふるさと納税額 − 2,000円) × (90% − 所得税の限界税率 × (1 + 復興特別所得税率))
 *    ただし住民税所得割額の20%が上限(`furusatoNozei.ts`の上限額試算と同じ式)。
 *
 * 簡略化している点:
 *  - 2,000円の足切りは寄附金の合計額に対して1回のみ適用する前提であり、
 *    ふるさと納税以外の寄附金控除対象(認定NPO法人等への寄附)が混在する場合の
 *    厳密な按分(本来は所得税と住民税で対象範囲が異なりうる)は行わない。
 *  - ワンストップ特例制度は考慮しない(確定申告での寄附金控除の適用を前提とする)。
 *  - 住宅ローン控除等、他の税額控除との兼ね合い(所得税額から控除しきれない
 *    場合に実際の恩恵が目減りすること)は考慮しない(`furusatoNozei.ts`と共通)。
 */

export interface DonationDeductionInput {
  /** 寄附金控除の対象となる寄附金の合計額(ふるさと納税分を含む) */
  totalDonationJpy: Decimal.Value;
  /** 上記のうち、住民税の特例控除(ふるさと納税)の対象となる額。totalDonationJpy以下。 */
  furusatoNozeiDonationJpy: Decimal.Value;
  /** その年の総所得金額等(寄附金控除の上限判定に使う) */
  totalIncomeJpy: Decimal.Value;
  /** 住民税所得割額(特例控除の上限20%判定用の概算値。`/tax-estimate`の試算結果等を入力する) */
  residentTaxIncomeLeviedJpy: Decimal.Value;
  /** 所得税の限界税率(0〜0.45。課税総所得金額に対応する速算表の税率) */
  marginalIncomeTaxRate: Decimal.Value;
}

export interface DonationDeductionResult {
  totalDonationJpy: Decimal;
  furusatoNozeiDonationJpy: Decimal;
  totalIncomeJpy: Decimal;
  residentTaxIncomeLeviedJpy: Decimal;
  marginalIncomeTaxRate: Decimal;
  /** 所得税の寄附金控除額(所得控除) */
  incomeTaxDeductionJpy: Decimal;
  /** 住民税の基本控除額 */
  residentTaxBasicDeductionJpy: Decimal;
  /** 住民税の特例控除額(ふるさと納税分。上限20%適用後) */
  residentTaxSpecialDeductionJpy: Decimal;
  /** 特例控除額の上限(住民税所得割額の20%) */
  residentTaxSpecialDeductionLimitJpy: Decimal;
  /** 住民税控除額の合計(基本控除+特例控除) */
  residentTaxTotalDeductionJpy: Decimal;
  notes: string[];
}

const INCOME_TAX_DEDUCTION_INCOME_CAP_RATE = 0.4;
const RESIDENT_TAX_BASIC_DEDUCTION_INCOME_CAP_RATE = 0.3;
const RESIDENT_TAX_BASIC_DEDUCTION_RATE = 0.1;
const RESIDENT_TAX_SPECIAL_DEDUCTION_LIMIT_RATE = 0.2;
const SELF_PAY_JPY = new Decimal(2_000);

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateDonationDeduction(
  input: DonationDeductionInput,
): DonationDeductionResult {
  const totalDonationJpy = new Decimal(input.totalDonationJpy);
  const furusatoNozeiDonationJpy = new Decimal(input.furusatoNozeiDonationJpy);
  const totalIncomeJpy = new Decimal(input.totalIncomeJpy);
  const residentTaxIncomeLeviedJpy = new Decimal(input.residentTaxIncomeLeviedJpy);
  const marginalIncomeTaxRate = new Decimal(input.marginalIncomeTaxRate);

  requireNonNegative(totalDonationJpy, "寄附金の合計額");
  requireNonNegative(furusatoNozeiDonationJpy, "ふるさと納税額");
  requireNonNegative(totalIncomeJpy, "総所得金額等");
  requireNonNegative(residentTaxIncomeLeviedJpy, "住民税所得割額");
  requireNonNegative(marginalIncomeTaxRate, "所得税の限界税率");
  if (marginalIncomeTaxRate.greaterThan(0.45)) {
    throw new Error("所得税の限界税率は45%以下である必要があります");
  }
  if (furusatoNozeiDonationJpy.greaterThan(totalDonationJpy)) {
    throw new Error("ふるさと納税額は寄附金の合計額以下である必要があります");
  }

  const notes: string[] = [
    "所得税法78条(寄附金控除)・地方税法37条の2等に基づく概算値。ワンストップ特例制度は考慮していない(確定申告での寄附金控除の適用を前提とする)。",
    "2,000円の足切りは寄附金の合計額に対して1回のみ適用する前提であり、ふるさと納税以外の寄附金控除対象(認定NPO法人等への寄附)が混在する場合の厳密な按分は行わない。",
    "住宅ローン控除等、他の税額控除との兼ね合い(所得税額から控除しきれない場合に実際の恩恵が目減りすること)は考慮していない。",
  ];

  const incomeTaxDeductionBaseJpy = Decimal.min(
    totalDonationJpy,
    totalIncomeJpy.times(INCOME_TAX_DEDUCTION_INCOME_CAP_RATE),
  );
  const incomeTaxDeductionJpy = Decimal.max(0, incomeTaxDeductionBaseJpy.minus(SELF_PAY_JPY));

  const residentTaxBasicDeductionBaseJpy = Decimal.min(
    totalDonationJpy,
    totalIncomeJpy.times(RESIDENT_TAX_BASIC_DEDUCTION_INCOME_CAP_RATE),
  );
  const residentTaxBasicDeductionJpy = Decimal.max(
    0,
    residentTaxBasicDeductionBaseJpy.minus(SELF_PAY_JPY),
  ).times(RESIDENT_TAX_BASIC_DEDUCTION_RATE);

  const residentTaxSpecialDeductionLimitJpy = residentTaxIncomeLeviedJpy.times(
    RESIDENT_TAX_SPECIAL_DEDUCTION_LIMIT_RATE,
  );
  const rawSpecialDeductionJpy = Decimal.max(
    0,
    furusatoNozeiDonationJpy.minus(SELF_PAY_JPY),
  ).times(new Decimal(0.9).minus(marginalIncomeTaxRate.times(1 + RECONSTRUCTION_SURTAX_RATE)));
  const residentTaxSpecialDeductionJpy = Decimal.max(
    0,
    Decimal.min(rawSpecialDeductionJpy, residentTaxSpecialDeductionLimitJpy),
  );
  if (rawSpecialDeductionJpy.greaterThan(residentTaxSpecialDeductionLimitJpy)) {
    notes.push(
      "特例控除額が住民税所得割額の20%を超えるため、上限額(住民税所得割額の20%)で頭打ちになっている。この場合、実際の自己負担額は2,000円を超える(`/tax-estimate`のふるさと納税上限額試算を参照)。",
    );
  }

  const residentTaxTotalDeductionJpy = residentTaxBasicDeductionJpy.plus(
    residentTaxSpecialDeductionJpy,
  );

  return {
    totalDonationJpy,
    furusatoNozeiDonationJpy,
    totalIncomeJpy,
    residentTaxIncomeLeviedJpy,
    marginalIncomeTaxRate,
    incomeTaxDeductionJpy,
    residentTaxBasicDeductionJpy,
    residentTaxSpecialDeductionJpy,
    residentTaxSpecialDeductionLimitJpy,
    residentTaxTotalDeductionJpy,
    notes,
  };
}
