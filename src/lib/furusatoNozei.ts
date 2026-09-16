import { Decimal } from "decimal.js";
import { RECONSTRUCTION_SURTAX_RATE } from "./incomeTax";

/**
 * ふるさと納税(寄附金控除)の年間上限額(自己負担額が実質2,000円になる目安)を
 * 試算する。総務省「ふるさと納税ポータルサイト」が公表する速算式に基づく概算値。
 *
 * 計算式:
 *   特例控除額の上限 = 住民税所得割額 × 20%
 *   全額控除となる年間上限額
 *     = 特例控除額の上限 ÷ (90% − 所得税の限界税率 × (1 + 復興特別所得税率)) + 2,000円
 *
 * 簡略化している点:
 *  - 住民税所得割額は呼び出し側(`estimateTotalTax`)が計算する概算値
 *    (所得割10%固定、均等割・調整控除は含まない)を前提とする。
 *  - ワンストップ特例制度を利用した場合の申告不要要件(寄附先5自治体以内等)は
 *    考慮しない。ワンストップ特例と確定申告のどちらでも上限額の考え方は同じ。
 *  - 住宅ローン控除等、他の税額控除との兼ね合い(控除しきれない所得税額がある
 *    場合に上限額が目減りする)は考慮しない。
 */

export interface FurusatoNozeiLimitInput {
  /** 住民税所得割額(年額。均等割を含まない所得割部分のみ) */
  residentTaxIncomeLeviedJpy: Decimal.Value;
  /** 所得税の限界税率(0〜0.45。課税総所得金額に対応する速算表の税率) */
  marginalIncomeTaxRate: Decimal.Value;
}

export interface FurusatoNozeiLimitResult {
  residentTaxIncomeLeviedJpy: Decimal;
  marginalIncomeTaxRate: Decimal;
  /** 特例控除額の上限(住民税所得割額の20%) */
  specialDeductionLimitJpy: Decimal;
  /** 自己負担2,000円を除いた全額が控除される年間寄付上限額の目安 */
  fullDeductionDonationLimitJpy: Decimal;
  notes: string[];
}

const SPECIAL_DEDUCTION_LIMIT_RATE = 0.2;
const SELF_PAY_JPY = new Decimal(2_000);

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateFurusatoNozeiLimit(
  input: FurusatoNozeiLimitInput,
): FurusatoNozeiLimitResult {
  const residentTaxIncomeLeviedJpy = new Decimal(input.residentTaxIncomeLeviedJpy);
  const marginalIncomeTaxRate = new Decimal(input.marginalIncomeTaxRate);

  requireNonNegative(residentTaxIncomeLeviedJpy, "住民税所得割額");
  requireNonNegative(marginalIncomeTaxRate, "所得税の限界税率");
  if (marginalIncomeTaxRate.greaterThan(0.45)) {
    throw new Error("所得税の限界税率は45%以下である必要があります");
  }

  const notes: string[] = [
    "総務省「ふるさと納税ポータルサイト」が公表する速算式による概算値であり、実際の控除額は自治体・税務署の計算で多少前後する。",
    "住民税所得割額は本ツールの概算合計税額試算による値(所得割10%固定、均等割・調整控除は含まない)を前提とする。",
    "住宅ローン控除等、他の税額控除との兼ね合いは考慮していない。控除しきれない所得税額がある場合、実際の上限額はこれより低くなることがある。",
  ];

  const specialDeductionLimitJpy = residentTaxIncomeLeviedJpy.times(SPECIAL_DEDUCTION_LIMIT_RATE);
  const denominator = new Decimal(0.9).minus(
    marginalIncomeTaxRate.times(1 + RECONSTRUCTION_SURTAX_RATE),
  );

  if (denominator.lessThanOrEqualTo(0) || residentTaxIncomeLeviedJpy.isZero()) {
    if (residentTaxIncomeLeviedJpy.isZero()) {
      notes.push("住民税所得割額が0円のため、ふるさと納税による控除額は発生しない。");
    } else {
      notes.push("所得税の限界税率が高すぎるため上限額を算出できなかった。");
    }
    return {
      residentTaxIncomeLeviedJpy,
      marginalIncomeTaxRate,
      specialDeductionLimitJpy,
      fullDeductionDonationLimitJpy: new Decimal(0),
      notes,
    };
  }

  const fullDeductionDonationLimitJpy = specialDeductionLimitJpy
    .dividedBy(denominator)
    .plus(SELF_PAY_JPY);

  return {
    residentTaxIncomeLeviedJpy,
    marginalIncomeTaxRate,
    specialDeductionLimitJpy,
    fullDeductionDonationLimitJpy,
    notes,
  };
}
