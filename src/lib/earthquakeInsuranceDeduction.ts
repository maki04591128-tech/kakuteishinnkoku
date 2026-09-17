import { Decimal } from "decimal.js";

/**
 * 地震保険料控除額を試算する(所得税法77条)。国税庁の計算方法に基づく概算値。
 *
 * 対象は「地震保険料」区分と、2006年12月31日までに締結した満期返戻金のある
 * 保険期間10年以上の長期損害保険契約等に係る「旧長期損害保険料」区分
 * (経過措置)の2つ。1つの契約が両方の区分に該当する場合は納税者がいずれか
 * 一方を選択する必要があるが、本ツールでは区分の判定・選択はユーザー自身が
 * 行う前提とする(生命保険料控除の個人年金保険料の区分判定と同様の考え方)。
 *
 * 地震保険料の計算式:
 *   所得税: 支払保険料の全額(上限5万円)
 *   住民税: 支払保険料 × 1/2(上限2.5万円)
 *
 * 旧長期損害保険料(経過措置)の速算式:
 *   所得税(上限1.5万円):
 *     1万円以下          → 全額
 *     1万円超2万円以下   → 支払保険料 × 1/2 + 5千円
 *     2万円超            → 一律1.5万円
 *   住民税(上限1万円):
 *     5千円以下          → 全額
 *     5千円超1.5万円以下 → 支払保険料 × 1/2 + 2.5千円
 *     1.5万円超          → 一律1万円
 *
 * 全体の適用限度額は所得税5万円・住民税2.5万円(地震保険料区分と旧長期損害
 * 保険料区分の控除額を合算した後、この上限で頭打ちにする)。
 *
 * 簡略化している点:
 *  - 各区分の控除額は円未満の端数を切り捨てずDecimalの計算結果をそのまま返す
 *    (実際の申告では円未満切り捨てとなる場合があるため、あくまで概算値)。
 */

export interface EarthquakeInsuranceDeductionInput {
  /** 地震保険料の年間払込保険料 */
  earthquakePremiumJpy: Decimal.Value;
  /** 旧長期損害保険料(経過措置対象契約)の年間払込保険料 */
  oldLongTermPremiumJpy: Decimal.Value;
}

export interface EarthquakeInsuranceDeductionResult {
  earthquakePremiumJpy: Decimal;
  oldLongTermPremiumJpy: Decimal;
  /** 地震保険料区分の控除額(所得税・上限5万円) */
  earthquakeIncomeTaxDeductionJpy: Decimal;
  /** 地震保険料区分の控除額(住民税・上限2.5万円) */
  earthquakeResidentTaxDeductionJpy: Decimal;
  /** 旧長期損害保険料区分の控除額(所得税・上限1.5万円) */
  oldLongTermIncomeTaxDeductionJpy: Decimal;
  /** 旧長期損害保険料区分の控除額(住民税・上限1万円) */
  oldLongTermResidentTaxDeductionJpy: Decimal;
  /** 地震保険料控除額の合計(所得税。上限5万円) */
  totalIncomeTaxDeductionJpy: Decimal;
  /** 地震保険料控除額の合計(住民税。上限2.5万円) */
  totalResidentTaxDeductionJpy: Decimal;
  notes: string[];
}

const INCOME_TAX_EARTHQUAKE_MAX_JPY = new Decimal(50_000);
const INCOME_TAX_OLD_LONG_TERM_MAX_JPY = new Decimal(15_000);
const INCOME_TAX_TOTAL_MAX_JPY = new Decimal(50_000);

const RESIDENT_TAX_EARTHQUAKE_MAX_JPY = new Decimal(25_000);
const RESIDENT_TAX_OLD_LONG_TERM_MAX_JPY = new Decimal(10_000);
const RESIDENT_TAX_TOTAL_MAX_JPY = new Decimal(25_000);

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

function earthquakeIncomeTax(premium: Decimal): Decimal {
  return Decimal.min(premium, INCOME_TAX_EARTHQUAKE_MAX_JPY);
}

function earthquakeResidentTax(premium: Decimal): Decimal {
  return Decimal.min(premium.dividedBy(2), RESIDENT_TAX_EARTHQUAKE_MAX_JPY);
}

function oldLongTermIncomeTax(premium: Decimal): Decimal {
  if (premium.lessThanOrEqualTo(10_000)) return premium;
  if (premium.lessThanOrEqualTo(20_000)) return premium.dividedBy(2).plus(5_000);
  return INCOME_TAX_OLD_LONG_TERM_MAX_JPY;
}

function oldLongTermResidentTax(premium: Decimal): Decimal {
  if (premium.lessThanOrEqualTo(5_000)) return premium;
  if (premium.lessThanOrEqualTo(15_000)) return premium.dividedBy(2).plus(2_500);
  return RESIDENT_TAX_OLD_LONG_TERM_MAX_JPY;
}

export function estimateEarthquakeInsuranceDeduction(
  input: EarthquakeInsuranceDeductionInput,
): EarthquakeInsuranceDeductionResult {
  const earthquakePremiumJpy = new Decimal(input.earthquakePremiumJpy);
  const oldLongTermPremiumJpy = new Decimal(input.oldLongTermPremiumJpy);

  requireNonNegative(earthquakePremiumJpy, "地震保険料");
  requireNonNegative(oldLongTermPremiumJpy, "旧長期損害保険料");

  const earthquakeIncomeTaxDeductionJpy = earthquakeIncomeTax(earthquakePremiumJpy);
  const earthquakeResidentTaxDeductionJpy = earthquakeResidentTax(earthquakePremiumJpy);
  const oldLongTermIncomeTaxDeductionJpy = oldLongTermIncomeTax(oldLongTermPremiumJpy);
  const oldLongTermResidentTaxDeductionJpy = oldLongTermResidentTax(oldLongTermPremiumJpy);

  const totalIncomeTaxDeductionJpy = Decimal.min(
    INCOME_TAX_TOTAL_MAX_JPY,
    earthquakeIncomeTaxDeductionJpy.plus(oldLongTermIncomeTaxDeductionJpy),
  );
  const totalResidentTaxDeductionJpy = Decimal.min(
    RESIDENT_TAX_TOTAL_MAX_JPY,
    earthquakeResidentTaxDeductionJpy.plus(oldLongTermResidentTaxDeductionJpy),
  );

  const notes: string[] = [
    "国税庁の地震保険料控除の計算方法による概算値。実際の申告では保険会社発行の控除証明書の金額を確認すること。",
    "旧長期損害保険料(経過措置)は2006年12月31日までに締結した満期返戻金のある保険期間10年以上の契約が対象。",
    "1つの契約が地震保険料・旧長期損害保険料の両方の要件を満たす場合、納税者はいずれか一方を選択する必要があるため、区分の判定はユーザー自身で確認すること。",
  ];

  return {
    earthquakePremiumJpy,
    oldLongTermPremiumJpy,
    earthquakeIncomeTaxDeductionJpy,
    earthquakeResidentTaxDeductionJpy,
    oldLongTermIncomeTaxDeductionJpy,
    oldLongTermResidentTaxDeductionJpy,
    totalIncomeTaxDeductionJpy,
    totalResidentTaxDeductionJpy,
    notes,
  };
}
