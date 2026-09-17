import { Decimal } from "decimal.js";

/**
 * 生命保険料控除額を試算する(所得税法76条)。国税庁の速算表に基づく概算値。
 *
 * 2012年(平成24年)の税制改正で計算方式が変わったため、契約日により
 * 「新制度」(2012年1月1日以後に締結した保険契約等)と「旧制度」
 * (2011年12月31日以前に締結した保険契約等)のいずれかの速算式が適用される。
 * 区分は一般生命保険料・介護医療保険料・個人年金保険料の3つ(介護医療保険料は
 * 新制度にのみ存在する区分で、旧制度の契約はこの区分に該当しない)。
 *
 * 新制度の速算式(区分ごとの年間払込保険料に対する控除額。上限4万円):
 *   2万円以下            → 全額
 *   2万円超4万円以下     → 支払保険料 × 1/2 + 1万円
 *   4万円超8万円以下     → 支払保険料 × 1/4 + 2万円
 *   8万円超              → 一律4万円
 *
 * 旧制度の速算式(区分ごとの年間払込保険料に対する控除額。上限5万円):
 *   2.5万円以下          → 全額
 *   2.5万円超5万円以下   → 支払保険料 × 1/2 + 1.25万円
 *   5万円超10万円以下    → 支払保険料 × 1/4 + 2.5万円
 *   10万円超             → 一律5万円
 *
 * 同一区分に新旧両方の契約がある場合、その区分の控除額は
 * (a)新制度の契約分のみで計算した額、(b)旧制度の契約分のみで計算した額、
 * (c)新旧それぞれの式で計算した額の合計(ただし新制度の上限である4万円が上限)
 * のうち最も有利な(大きい)金額を選択できるため、本ツールは3パターンを
 * 自動計算して最大値を採用する。
 *
 * 全体の適用限度額は所得税12万円・住民税7万円(各区分の控除額を合算した後、
 * この上限で頭打ちにする)。
 *
 * 簡略化している点:
 *  - 各区分の控除額は円未満の端数を切り捨てずDecimalの計算結果をそのまま返す
 *    (実際の申告では円未満切り捨てとなる場合があるため、あくまで概算値)。
 *  - 個人年金保険料は税制適格特約が付加された契約を前提とする(付加されていない
 *    個人年金保険料は一般生命保険料の区分になるが、本ツールでは区分の判定は
 *    ユーザー自身が行う前提とする)。
 */

export type LifeInsuranceCategory = "general" | "medicalCare" | "individualPension";

export interface LifeInsuranceCategoryInput {
  /** 新制度(2012年1月1日以後の契約)の年間払込保険料 */
  newPremiumJpy: Decimal.Value;
  /** 旧制度(2011年12月31日以前の契約)の年間払込保険料(介護医療保険料区分には存在しない) */
  oldPremiumJpy: Decimal.Value;
}

export interface LifeInsurancePremiumInput {
  /** 一般生命保険料 */
  general: LifeInsuranceCategoryInput;
  /** 介護医療保険料(新制度のみ) */
  medicalCare: { newPremiumJpy: Decimal.Value };
  /** 個人年金保険料 */
  individualPension: LifeInsuranceCategoryInput;
}

export interface LifeInsuranceCategoryResult {
  newPremiumJpy: Decimal;
  oldPremiumJpy: Decimal;
  /** 所得税の区分別控除額(新制度分・旧制度分・合算分のうち最も有利な金額) */
  incomeTaxDeductionJpy: Decimal;
  /** 住民税の区分別控除額(新制度分・旧制度分・合算分のうち最も有利な金額) */
  residentTaxDeductionJpy: Decimal;
}

export interface LifeInsurancePremiumResult {
  general: LifeInsuranceCategoryResult;
  medicalCare: LifeInsuranceCategoryResult;
  individualPension: LifeInsuranceCategoryResult;
  /** 所得税の生命保険料控除額(3区分合計。上限12万円) */
  totalIncomeTaxDeductionJpy: Decimal;
  /** 住民税の生命保険料控除額(3区分合計。上限7万円) */
  totalResidentTaxDeductionJpy: Decimal;
  notes: string[];
}

const INCOME_TAX_CATEGORY_MAX_JPY = new Decimal(40_000);
const INCOME_TAX_CATEGORY_MAX_OLD_JPY = new Decimal(50_000);
const INCOME_TAX_TOTAL_MAX_JPY = new Decimal(120_000);

const RESIDENT_TAX_CATEGORY_MAX_JPY = new Decimal(28_000);
const RESIDENT_TAX_CATEGORY_MAX_OLD_JPY = new Decimal(35_000);
const RESIDENT_TAX_TOTAL_MAX_JPY = new Decimal(70_000);

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

function newFormulaIncomeTax(premium: Decimal): Decimal {
  if (premium.lessThanOrEqualTo(20_000)) return premium;
  if (premium.lessThanOrEqualTo(40_000)) return premium.dividedBy(2).plus(10_000);
  if (premium.lessThanOrEqualTo(80_000)) return premium.dividedBy(4).plus(20_000);
  return INCOME_TAX_CATEGORY_MAX_JPY;
}

function oldFormulaIncomeTax(premium: Decimal): Decimal {
  if (premium.lessThanOrEqualTo(25_000)) return premium;
  if (premium.lessThanOrEqualTo(50_000)) return premium.dividedBy(2).plus(12_500);
  if (premium.lessThanOrEqualTo(100_000)) return premium.dividedBy(4).plus(25_000);
  return INCOME_TAX_CATEGORY_MAX_OLD_JPY;
}

function newFormulaResidentTax(premium: Decimal): Decimal {
  if (premium.lessThanOrEqualTo(12_000)) return premium;
  if (premium.lessThanOrEqualTo(32_000)) return premium.dividedBy(2).plus(6_000);
  if (premium.lessThanOrEqualTo(56_000)) return premium.dividedBy(4).plus(14_000);
  return RESIDENT_TAX_CATEGORY_MAX_JPY;
}

function oldFormulaResidentTax(premium: Decimal): Decimal {
  if (premium.lessThanOrEqualTo(15_000)) return premium;
  if (premium.lessThanOrEqualTo(40_000)) return premium.dividedBy(2).plus(7_500);
  if (premium.lessThanOrEqualTo(70_000)) return premium.dividedBy(4).plus(17_500);
  return RESIDENT_TAX_CATEGORY_MAX_OLD_JPY;
}

function bestOf(...values: Decimal[]): Decimal {
  return values.reduce((max, value) => Decimal.max(max, value), new Decimal(0));
}

function calculateCategory(
  newPremiumJpy: Decimal,
  oldPremiumJpy: Decimal,
): LifeInsuranceCategoryResult {
  const newIncomeTax = newFormulaIncomeTax(newPremiumJpy);
  const oldIncomeTax = oldFormulaIncomeTax(oldPremiumJpy);
  const combinedIncomeTax = Decimal.min(
    INCOME_TAX_CATEGORY_MAX_JPY,
    newIncomeTax.plus(oldIncomeTax),
  );
  const incomeTaxDeductionJpy = bestOf(newIncomeTax, oldIncomeTax, combinedIncomeTax);

  const newResidentTax = newFormulaResidentTax(newPremiumJpy);
  const oldResidentTax = oldFormulaResidentTax(oldPremiumJpy);
  const combinedResidentTax = Decimal.min(
    RESIDENT_TAX_CATEGORY_MAX_JPY,
    newResidentTax.plus(oldResidentTax),
  );
  const residentTaxDeductionJpy = bestOf(newResidentTax, oldResidentTax, combinedResidentTax);

  return {
    newPremiumJpy,
    oldPremiumJpy,
    incomeTaxDeductionJpy,
    residentTaxDeductionJpy,
  };
}

export function estimateLifeInsurancePremiumDeduction(
  input: LifeInsurancePremiumInput,
): LifeInsurancePremiumResult {
  const generalNewPremiumJpy = new Decimal(input.general.newPremiumJpy);
  const generalOldPremiumJpy = new Decimal(input.general.oldPremiumJpy);
  const medicalCareNewPremiumJpy = new Decimal(input.medicalCare.newPremiumJpy);
  const individualPensionNewPremiumJpy = new Decimal(input.individualPension.newPremiumJpy);
  const individualPensionOldPremiumJpy = new Decimal(input.individualPension.oldPremiumJpy);

  requireNonNegative(generalNewPremiumJpy, "一般生命保険料(新制度)");
  requireNonNegative(generalOldPremiumJpy, "一般生命保険料(旧制度)");
  requireNonNegative(medicalCareNewPremiumJpy, "介護医療保険料");
  requireNonNegative(individualPensionNewPremiumJpy, "個人年金保険料(新制度)");
  requireNonNegative(individualPensionOldPremiumJpy, "個人年金保険料(旧制度)");

  const general = calculateCategory(generalNewPremiumJpy, generalOldPremiumJpy);
  const medicalCare = calculateCategory(medicalCareNewPremiumJpy, new Decimal(0));
  const individualPension = calculateCategory(
    individualPensionNewPremiumJpy,
    individualPensionOldPremiumJpy,
  );

  const totalIncomeTaxDeductionJpy = Decimal.min(
    INCOME_TAX_TOTAL_MAX_JPY,
    general.incomeTaxDeductionJpy
      .plus(medicalCare.incomeTaxDeductionJpy)
      .plus(individualPension.incomeTaxDeductionJpy),
  );
  const totalResidentTaxDeductionJpy = Decimal.min(
    RESIDENT_TAX_TOTAL_MAX_JPY,
    general.residentTaxDeductionJpy
      .plus(medicalCare.residentTaxDeductionJpy)
      .plus(individualPension.residentTaxDeductionJpy),
  );

  const notes: string[] = [
    "国税庁の生命保険料控除の速算表による概算値。実際の申告では生命保険会社発行の控除証明書の金額を確認すること。",
    "区分ごとに新制度・旧制度の契約が両方ある場合、新制度分のみ・旧制度分のみ・新旧合算のうち最も有利な金額を自動選択している。",
    "介護医療保険料は新制度にのみ存在する区分のため、旧制度の入力欄は設けていない。",
    "個人年金保険料は税制適格特約付きの契約を前提とする。特約が無い個人年金保険料は一般生命保険料の区分に該当するため、区分はユーザー自身で確認すること。",
  ];

  return {
    general,
    medicalCare,
    individualPension,
    totalIncomeTaxDeductionJpy,
    totalResidentTaxDeductionJpy,
    notes,
  };
}
