import { Decimal } from "decimal.js";
import { RECONSTRUCTION_SURTAX_RATE } from "./incomeTax";

/**
 * 政党等・認定NPO法人等・公益社団法人等寄附金特別控除(税額控除)の試算
 * (租税特別措置法41条の18・41条の18の2・41条の18の3)。
 *
 * これら3区分への寄附は、通常の寄附金控除(所得控除。`donationDeduction.ts`)を
 * 受けるか、この特別控除(税額控除)を受けるか、所得税の計算上いずれか有利な方を
 * 選択できる(国税庁タックスアンサーNo.1260「政党等に寄附をしたとき」・
 * No.1263「認定NPO法人に寄附をしたとき」・No.1266「公益社団法人等に寄附をしたとき」で
 * 算式・上限を確認した上で実装した)。この選択はあくまで所得税の計算上の話であり、
 * 住民税の寄附金控除(基本控除)は寄附先が都道府県・市区町村の条例で指定されているかで
 * 別途決まる(全国一律の対象ではない)ため、本モジュールでは住民税への影響は
 * 試算しない(今後の課題)。
 *
 * 計算式(3区分共通の枠組み):
 *   特別控除額 = (寄附金の額の合計額(総所得金額等の40%が上限) − 2,000円) × 控除率
 *     (100円未満切り捨て)
 *   控除率は政党等が30%、認定NPO法人等・公益社団法人等がそれぞれ40%。
 *   政党等寄附金特別控除額は、その年分の所得税額の25%相当額(100円未満切り捨て)が
 *   上限。認定NPO法人等寄附金特別控除額と公益社団法人等寄附金特別控除額は合算して
 *   所得税額の25%相当額(100円未満切り捨て)が上限(政党等とは別枠)。
 *
 * 簡略化している点:
 *  - 2,000円の足切り・総所得金額等40%の上限は、政党等・認定NPO法人等・
 *    公益社団法人等・通常の寄附金控除(ふるさと納税等)の各区分に独立に適用する
 *    前提であり、複数区分の寄附が混在する場合の厳密な按分(本来は特定寄附金等の
 *    合計額を基準に按分する)は行わない(`donationDeduction.ts`と同様の簡略化)。
 *  - 認定NPO法人等・公益社団法人等の控除額が合算25%上限を超える場合、国税庁の
 *    説明では公益社団法人等寄附金特別控除額を優先して25%枠に充当するとされるが、
 *    本モジュールでは単純に合計額を上限で頭打ちする簡略化とする。
 */

export type DonationTaxCreditCategory =
  | "POLITICAL_PARTY"
  | "CERTIFIED_NPO"
  | "PUBLIC_INTEREST_CORPORATION";

export const DONATION_TAX_CREDIT_CATEGORY_LABELS: Record<DonationTaxCreditCategory, string> = {
  POLITICAL_PARTY: "政党等寄附金特別控除",
  CERTIFIED_NPO: "認定NPO法人等寄附金特別控除",
  PUBLIC_INTEREST_CORPORATION: "公益社団法人等寄附金特別控除",
};

const INCOME_CAP_RATE = 0.4;
const SELF_PAY_JPY = new Decimal(2_000);
const POLITICAL_PARTY_CREDIT_RATE = 0.3;
const NPO_AND_PUBLIC_INTEREST_CREDIT_RATE = 0.4;
const TAX_AMOUNT_CAP_RATE = 0.25;

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

function floorToHundredYen(value: Decimal): Decimal {
  return value.dividedBy(100).floor().times(100);
}

/** 寄附金の額(40%上限適用後)から2,000円を差し引いた額に控除率を掛け、100円未満を切り捨てる */
function rawCreditJpy(donationJpy: Decimal, totalIncomeJpy: Decimal, rate: number): Decimal {
  const capped = Decimal.min(donationJpy, totalIncomeJpy.times(INCOME_CAP_RATE));
  const base = Decimal.max(0, capped.minus(SELF_PAY_JPY));
  return floorToHundredYen(base.times(rate));
}

export interface DonationTaxCreditInput {
  /** 政党等(政党・政治資金団体)に対する寄附金の額の合計額 */
  politicalPartyDonationJpy: Decimal.Value;
  /** 認定NPO法人・特例認定NPO法人に対する寄附金の額の合計額 */
  certifiedNpoDonationJpy: Decimal.Value;
  /** 公益社団法人・公益財団法人等に対する寄附金の額の合計額 */
  publicInterestCorporationDonationJpy: Decimal.Value;
  /** その年の総所得金額等(寄附金額の40%上限判定に使う) */
  totalIncomeJpy: Decimal.Value;
  /** この特別控除を適用する前の、その年分の所得税額(25%上限判定に使う) */
  incomeTaxBeforeCreditJpy: Decimal.Value;
}

export interface DonationTaxCreditResult {
  politicalPartyDonationJpy: Decimal;
  certifiedNpoDonationJpy: Decimal;
  publicInterestCorporationDonationJpy: Decimal;
  totalIncomeJpy: Decimal;
  incomeTaxBeforeCreditJpy: Decimal;
  /** 所得税額の25%相当額(100円未満切り捨て)。政党等・NPO等+公益法人等それぞれの上限として使う */
  taxAmountCapJpy: Decimal;
  /** 政党等寄附金特別控除額(25%上限適用後) */
  politicalPartyCreditJpy: Decimal;
  /** 認定NPO法人等寄附金特別控除額(上限適用前) */
  certifiedNpoCreditRawJpy: Decimal;
  /** 公益社団法人等寄附金特別控除額(上限適用前) */
  publicInterestCorporationCreditRawJpy: Decimal;
  /** 認定NPO法人等・公益社団法人等の控除額の合計(25%上限適用後) */
  npoAndPublicInterestCreditJpy: Decimal;
  /** 3区分合計の特別控除額 */
  totalTaxCreditJpy: Decimal;
  notes: string[];
}

export function estimateDonationTaxCredit(input: DonationTaxCreditInput): DonationTaxCreditResult {
  const politicalPartyDonationJpy = new Decimal(input.politicalPartyDonationJpy);
  const certifiedNpoDonationJpy = new Decimal(input.certifiedNpoDonationJpy);
  const publicInterestCorporationDonationJpy = new Decimal(
    input.publicInterestCorporationDonationJpy,
  );
  const totalIncomeJpy = new Decimal(input.totalIncomeJpy);
  const incomeTaxBeforeCreditJpy = new Decimal(input.incomeTaxBeforeCreditJpy);

  requireNonNegative(politicalPartyDonationJpy, "政党等に対する寄附金の額");
  requireNonNegative(certifiedNpoDonationJpy, "認定NPO法人等に対する寄附金の額");
  requireNonNegative(
    publicInterestCorporationDonationJpy,
    "公益社団法人等に対する寄附金の額",
  );
  requireNonNegative(totalIncomeJpy, "総所得金額等");
  requireNonNegative(incomeTaxBeforeCreditJpy, "特別控除適用前の所得税額");

  const notes: string[] = [
    "租税特別措置法41条の18(政党等)・41条の18の2(認定NPO法人等)・41条の18の3(公益社団法人等)に基づく概算値。これらの寄附は、通常の寄附金控除(所得控除)を受けるか、この特別控除(税額控除)を受けるか、所得税の計算上いずれか有利な方を選択できる。",
    "選択はあくまで所得税の計算上の話であり、住民税の寄附金控除(基本控除)は寄附先が都道府県・市区町村の条例で指定されているかで別途決まる(全国一律の対象ではない)ため、住民税への影響は試算していない。",
    "2,000円の足切り・総所得金額等40%の上限は各区分に独立に適用する前提であり、複数区分の寄附や通常の寄附金控除対象(ふるさと納税等)が混在する場合の厳密な按分は行わない。",
  ];

  const taxAmountCapJpy = floorToHundredYen(incomeTaxBeforeCreditJpy.times(TAX_AMOUNT_CAP_RATE));

  const politicalPartyCreditRawJpy = rawCreditJpy(
    politicalPartyDonationJpy,
    totalIncomeJpy,
    POLITICAL_PARTY_CREDIT_RATE,
  );
  const politicalPartyCreditJpy = Decimal.min(politicalPartyCreditRawJpy, taxAmountCapJpy);
  if (politicalPartyCreditRawJpy.greaterThan(politicalPartyCreditJpy)) {
    notes.push(
      "政党等寄附金特別控除額が所得税額の25%相当額を超えるため、上限額で頭打ちになっている。",
    );
  }

  const certifiedNpoCreditRawJpy = rawCreditJpy(
    certifiedNpoDonationJpy,
    totalIncomeJpy,
    NPO_AND_PUBLIC_INTEREST_CREDIT_RATE,
  );
  const publicInterestCorporationCreditRawJpy = rawCreditJpy(
    publicInterestCorporationDonationJpy,
    totalIncomeJpy,
    NPO_AND_PUBLIC_INTEREST_CREDIT_RATE,
  );
  const npoAndPublicInterestCreditRawJpy = certifiedNpoCreditRawJpy.plus(
    publicInterestCorporationCreditRawJpy,
  );
  const npoAndPublicInterestCreditJpy = Decimal.min(
    npoAndPublicInterestCreditRawJpy,
    taxAmountCapJpy,
  );
  if (npoAndPublicInterestCreditRawJpy.greaterThan(npoAndPublicInterestCreditJpy)) {
    notes.push(
      "認定NPO法人等・公益社団法人等寄附金特別控除額の合計が所得税額の25%相当額を超えるため、上限額で頭打ちになっている(政党等寄附金特別控除とは別枠)。",
    );
  }

  const totalTaxCreditJpy = politicalPartyCreditJpy.plus(npoAndPublicInterestCreditJpy);

  return {
    politicalPartyDonationJpy,
    certifiedNpoDonationJpy,
    publicInterestCorporationDonationJpy,
    totalIncomeJpy,
    incomeTaxBeforeCreditJpy,
    taxAmountCapJpy,
    politicalPartyCreditJpy,
    certifiedNpoCreditRawJpy,
    publicInterestCorporationCreditRawJpy,
    npoAndPublicInterestCreditJpy,
    totalTaxCreditJpy,
    notes,
  };
}

export type DonationTaxTreatmentRecommendation = "TAX_CREDIT" | "INCOME_DEDUCTION" | "EITHER";

export interface DonationTaxTreatmentComparison {
  category: DonationTaxCreditCategory;
  /** この特別控除(税額控除)を選んだ場合の所得税額の軽減額 */
  taxCreditJpy: Decimal;
  /** 通常の寄附金控除(所得控除)を選んだ場合の所得税額の軽減額(所得控除額×限界税率で概算) */
  incomeDeductionIncomeTaxSavingsJpy: Decimal;
  /** どちらを選ぶと所得税が有利か(同額の場合はEITHER) */
  recommended: DonationTaxTreatmentRecommendation;
  /** 有利な方と不利な方の所得税軽減額の差 */
  advantageJpy: Decimal;
}

/**
 * 単一区分の寄附について、特別控除(税額控除)と通常の寄附金控除(所得控除)の
 * どちらを選ぶと所得税が有利かを比較する。所得控除ルートの軽減額は
 * 「(寄附金の額(40%上限適用後)−2,000円)×限界税率×(1+復興特別所得税率)」で概算する
 * (復興特別所得税分も限界税率に乗じて軽減額に含める簡略化。実際は所得税・
 * 復興特別所得税それぞれの計算式に基づく)。
 */
export function compareDonationTaxTreatment(
  category: DonationTaxCreditCategory,
  donationJpy: Decimal.Value,
  totalIncomeJpy: Decimal.Value,
  incomeTaxBeforeCreditJpy: Decimal.Value,
  marginalIncomeTaxRate: Decimal.Value,
): DonationTaxTreatmentComparison {
  const donation = new Decimal(donationJpy);
  const totalIncome = new Decimal(totalIncomeJpy);
  const incomeTaxBeforeCredit = new Decimal(incomeTaxBeforeCreditJpy);
  const marginalRate = new Decimal(marginalIncomeTaxRate);

  requireNonNegative(donation, "寄附金の額");
  requireNonNegative(totalIncome, "総所得金額等");
  requireNonNegative(incomeTaxBeforeCredit, "特別控除適用前の所得税額");
  requireNonNegative(marginalRate, "所得税の限界税率");
  if (marginalRate.greaterThan(0.45)) {
    throw new Error("所得税の限界税率は45%以下である必要があります");
  }

  const zero = new Decimal(0);
  const result = estimateDonationTaxCredit({
    politicalPartyDonationJpy: category === "POLITICAL_PARTY" ? donation : zero,
    certifiedNpoDonationJpy: category === "CERTIFIED_NPO" ? donation : zero,
    publicInterestCorporationDonationJpy:
      category === "PUBLIC_INTEREST_CORPORATION" ? donation : zero,
    totalIncomeJpy: totalIncome,
    incomeTaxBeforeCreditJpy: incomeTaxBeforeCredit,
  });
  const taxCreditJpy = result.totalTaxCreditJpy;

  const incomeDeductionBaseJpy = Decimal.max(
    0,
    Decimal.min(donation, totalIncome.times(INCOME_CAP_RATE)).minus(SELF_PAY_JPY),
  );
  const incomeDeductionIncomeTaxSavingsJpy = incomeDeductionBaseJpy.times(
    marginalRate.times(1 + RECONSTRUCTION_SURTAX_RATE),
  );

  const recommended: DonationTaxTreatmentRecommendation = taxCreditJpy.equals(
    incomeDeductionIncomeTaxSavingsJpy,
  )
    ? "EITHER"
    : taxCreditJpy.greaterThan(incomeDeductionIncomeTaxSavingsJpy)
      ? "TAX_CREDIT"
      : "INCOME_DEDUCTION";
  const advantageJpy = Decimal.max(taxCreditJpy, incomeDeductionIncomeTaxSavingsJpy).minus(
    Decimal.min(taxCreditJpy, incomeDeductionIncomeTaxSavingsJpy),
  );

  return {
    category,
    taxCreditJpy,
    incomeDeductionIncomeTaxSavingsJpy,
    recommended,
    advantageJpy,
  };
}
