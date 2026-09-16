import { Decimal } from "decimal.js";

/**
 * 所得税・住民税の税率計算のうち、複数の所得区分(配当所得の課税方式
 * シミュレーション・全体の概算税額試算)で共通して使う速算表・税率をまとめる。
 *
 * 簡略化している点(呼び出し側の各シミュレーターと共通):
 *  - 住民税は所得割10%固定(均等割・調整控除は考慮しない)。
 *  - 申告分離課税(上場株式等の譲渡所得・配当所得・先物取引に係る雑所得等)は
 *    令和19年分までの復興特別所得税を含め一律20.315%(所得税15.315%+住民税5%)。
 */

// 所得税の速算表(令和年分。復興特別所得税を含まない所得税本体の税率・控除額)
export const INCOME_TAX_BRACKETS: { minJpy: number; rate: number; deductionJpy: number }[] = [
  { minJpy: 0, rate: 0.05, deductionJpy: 0 },
  { minJpy: 1_950_000, rate: 0.1, deductionJpy: 97_500 },
  { minJpy: 3_300_000, rate: 0.2, deductionJpy: 427_500 },
  { minJpy: 6_950_000, rate: 0.23, deductionJpy: 636_000 },
  { minJpy: 9_000_000, rate: 0.33, deductionJpy: 1_536_000 },
  { minJpy: 18_000_000, rate: 0.4, deductionJpy: 2_796_000 },
  { minJpy: 40_000_000, rate: 0.45, deductionJpy: 4_796_000 },
];

// 復興特別所得税(令和19年分まで、所得税額に対して2.1%)
export const RECONSTRUCTION_SURTAX_RATE = 0.021;
// 住民税(所得割)は所得に関わらず一律10%として扱う(均等割・調整控除は考慮しない)
export const RESIDENT_TAX_RATE = 0.1;
// 申告分離課税(上場株式等の譲渡所得・配当所得・先物取引に係る雑所得等)の税率
export const SEPARATE_NATIONAL_TAX_RATE = 0.15 * (1 + RECONSTRUCTION_SURTAX_RATE);
export const SEPARATE_RESIDENT_TAX_RATE = 0.05;

function bracketForTaxableIncome(taxableIncomeJpy: Decimal): (typeof INCOME_TAX_BRACKETS)[number] {
  const income = Decimal.max(taxableIncomeJpy, 0);
  let bracket = INCOME_TAX_BRACKETS[0];
  for (const b of INCOME_TAX_BRACKETS) {
    if (income.greaterThanOrEqualTo(b.minJpy)) {
      bracket = b;
    }
  }
  return bracket;
}

/** 課税所得金額に速算表を適用し、所得税額(復興特別所得税を含まない)を計算する */
export function nationalIncomeTaxBaseJpy(taxableIncomeJpy: Decimal): Decimal {
  const income = Decimal.max(taxableIncomeJpy, 0);
  const bracket = bracketForTaxableIncome(income);
  return Decimal.max(income.times(bracket.rate).minus(bracket.deductionJpy), 0);
}

/**
 * 課税所得金額に対応する所得税の限界税率(速算表の税率。復興特別所得税を含まない)。
 * ふるさと納税(寄附金控除)の上限額試算等、超過累進税率のうち最上位の
 * 適用税率のみが必要な場面で使う。
 */
export function marginalIncomeTaxRate(taxableIncomeJpy: Decimal): Decimal {
  return new Decimal(bracketForTaxableIncome(taxableIncomeJpy).rate);
}

/** 復興特別所得税を含めた所得税額(住民税を含まない) */
export function nationalIncomeTaxWithSurtaxJpy(taxableIncomeJpy: Decimal): Decimal {
  return nationalIncomeTaxBaseJpy(taxableIncomeJpy).times(1 + RECONSTRUCTION_SURTAX_RATE);
}
