import { Decimal } from "decimal.js";

/**
 * 障害者控除額を試算する(所得税法79条・国税庁タックスアンサーNo.1160)。
 *
 * 対象は「納税者本人」または「同一生計配偶者・扶養親族」が障害者に該当する場合。
 * 扶養親族については、扶養控除の対象となる控除対象扶養親族(16歳以上)に
 * 限らず、16歳未満の扶養親族(住民税の扶養控除のみ対象・所得税の扶養控除は
 * 対象外)であっても、障害者に該当すれば障害者控除の対象になる点に注意
 * (この試算では人数を直接入力する方式のため、年齢要件の判定自体はユーザーに
 * 委ねる)。
 *
 * 区分ごとの控除額(1人あたり):
 *   障害者(一般): 所得税27万円・住民税26万円
 *   特別障害者: 所得税40万円・住民税30万円
 *   同居特別障害者(特別障害者に該当する同一生計配偶者・扶養親族のうち、
 *     納税者・配偶者・その他生計を一にする親族のいずれかと同居している者):
 *     所得税75万円・住民税53万円
 *
 * 「同居特別障害者」は同一生計配偶者・扶養親族のみが対象の区分であり、
 * 納税者本人には適用されない(本人は「障害者」または「特別障害者」までの
 * いずれか)。
 *
 * 控除対象者の人数に上限は無く、該当する人数分だけ加算される。
 */

export type DisabilityCategory = "NONE" | "GENERAL" | "SPECIAL";

export interface DisabilityDeductionInput {
  /** 納税者本人の障害区分(本人は「同居特別障害者」区分の対象外) */
  taxpayerCategory: DisabilityCategory;
  /** 同一生計配偶者・扶養親族のうち、障害者(一般)に該当する人数 */
  generalCount: number;
  /** 同一生計配偶者・扶養親族のうち、特別障害者(同居特別障害者を除く)に該当する人数 */
  specialCount: number;
  /** 同一生計配偶者・扶養親族のうち、同居特別障害者に該当する人数 */
  specialLivingTogetherCount: number;
}

export interface DisabilityDeductionResult {
  taxpayerIncomeTaxDeductionJpy: Decimal;
  taxpayerResidentTaxDeductionJpy: Decimal;
  relativesIncomeTaxDeductionJpy: Decimal;
  relativesResidentTaxDeductionJpy: Decimal;
  totalIncomeTaxDeductionJpy: Decimal;
  totalResidentTaxDeductionJpy: Decimal;
  notes: string[];
}

const GENERAL_INCOME_TAX_JPY = new Decimal(270_000);
const SPECIAL_INCOME_TAX_JPY = new Decimal(400_000);
const SPECIAL_LIVING_TOGETHER_INCOME_TAX_JPY = new Decimal(750_000);

const GENERAL_RESIDENT_TAX_JPY = new Decimal(260_000);
const SPECIAL_RESIDENT_TAX_JPY = new Decimal(300_000);
const SPECIAL_LIVING_TOGETHER_RESIDENT_TAX_JPY = new Decimal(530_000);

function requireNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label}は0以上の整数である必要があります`);
  }
}

function taxpayerDeduction(category: DisabilityCategory): {
  incomeTaxAmountJpy: Decimal;
  residentTaxAmountJpy: Decimal;
} {
  switch (category) {
    case "SPECIAL":
      return {
        incomeTaxAmountJpy: SPECIAL_INCOME_TAX_JPY,
        residentTaxAmountJpy: SPECIAL_RESIDENT_TAX_JPY,
      };
    case "GENERAL":
      return {
        incomeTaxAmountJpy: GENERAL_INCOME_TAX_JPY,
        residentTaxAmountJpy: GENERAL_RESIDENT_TAX_JPY,
      };
    case "NONE":
      return { incomeTaxAmountJpy: new Decimal(0), residentTaxAmountJpy: new Decimal(0) };
  }
}

export function estimateDisabilityDeduction(
  input: DisabilityDeductionInput,
): DisabilityDeductionResult {
  requireNonNegativeInteger(input.generalCount, "障害者(一般)の人数");
  requireNonNegativeInteger(input.specialCount, "特別障害者の人数");
  requireNonNegativeInteger(input.specialLivingTogetherCount, "同居特別障害者の人数");

  const taxpayer = taxpayerDeduction(input.taxpayerCategory);

  const relativesIncomeTaxDeductionJpy = GENERAL_INCOME_TAX_JPY.times(input.generalCount)
    .plus(SPECIAL_INCOME_TAX_JPY.times(input.specialCount))
    .plus(SPECIAL_LIVING_TOGETHER_INCOME_TAX_JPY.times(input.specialLivingTogetherCount));
  const relativesResidentTaxDeductionJpy = GENERAL_RESIDENT_TAX_JPY.times(input.generalCount)
    .plus(SPECIAL_RESIDENT_TAX_JPY.times(input.specialCount))
    .plus(SPECIAL_LIVING_TOGETHER_RESIDENT_TAX_JPY.times(input.specialLivingTogetherCount));

  const notes: string[] = [
    "国税庁タックスアンサーNo.1160の速算表による概算値。実際の適用可否(障害者手帳の等級等)は市区町村・税務署の基準を確認すること。",
    "「同居特別障害者」は特別障害者に該当する同一生計配偶者・扶養親族のうち、納税者本人・配偶者・その他生計を一にする親族のいずれかと同居している者が対象。納税者本人には適用されない。",
    "扶養親族については、扶養控除の対象となる16歳以上の控除対象扶養親族に限らず、16歳未満の扶養親族が障害者に該当する場合も障害者控除の対象になる(年齢要件自体の判定はユーザー自身で行うこと)。",
  ];

  return {
    taxpayerIncomeTaxDeductionJpy: taxpayer.incomeTaxAmountJpy,
    taxpayerResidentTaxDeductionJpy: taxpayer.residentTaxAmountJpy,
    relativesIncomeTaxDeductionJpy,
    relativesResidentTaxDeductionJpy,
    totalIncomeTaxDeductionJpy: taxpayer.incomeTaxAmountJpy.plus(relativesIncomeTaxDeductionJpy),
    totalResidentTaxDeductionJpy: taxpayer.residentTaxAmountJpy.plus(
      relativesResidentTaxDeductionJpy,
    ),
    notes,
  };
}
