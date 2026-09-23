import { Decimal } from "decimal.js";
import {
  RESIDENT_TAX_RATE,
  SEPARATE_NATIONAL_TAX_RATE,
  SEPARATE_RESIDENT_TAX_RATE,
  marginalIncomeTaxRate,
  nationalIncomeTaxWithSurtaxJpy,
} from "./incomeTax";
import {
  simulateDividendTaxation,
  type DividendTaxMethod,
  type DividendTaxMethodResult,
  type DividendTaxSimulationResult,
} from "./investment/dividendTaxSimulation";
import { estimateFurusatoNozeiLimit, type FurusatoNozeiLimitResult } from "./furusatoNozei";

/**
 * ダッシュボードの各所得区分(暗号資産の雑所得・株式等の譲渡所得・配当所得・
 * 先物取引に係る雑所得等)を合算し、その年の所得税・復興特別所得税・住民税の
 * 概算合計額を試算する。
 *
 * 所得区分ごとの課税方式:
 *  - 暗号資産の雑所得: 給与所得等と合算する総合課税(超過累進税率)。
 *  - 株式等の譲渡所得・先物取引に係る雑所得等: それぞれ別プールの
 *    申告分離課税(一律20.315%)。両者は損益通算できない。
 *  - 配当所得: 総合課税・申告分離課税・申告不要のいずれか
 *    (`dividendTaxSimulation.ts`の試算結果を利用し、`dividendMethod`で
 *    指定がなければ最も税負担が軽い方式を採用する)。
 *
 * 簡略化している点(呼び出し元の各シミュレーターと共通):
 *  - `otherComprehensiveIncomeJpy`(給与所得等)は基礎控除等の所得控除を
 *    既に差し引いた課税所得金額としてユーザーが入力する前提であり、
 *    本モジュールは所得控除の計算を行わない。
 *  - 住民税は所得割10%固定(均等割・調整控除は考慮しない)。
 *  - 予定納税額・源泉徴収税額との相殺(還付・納付額の算出)は行わない。
 *    ここで求めるのはあくまで年間の税額そのものの概算値。
 *
 * 住宅ローン控除(`mortgageDeduction.ts`)は所得控除ではなく税額控除のため、
 * 上記の各所得区分の税額を合算した後の合計税額から直接差し引く。所得税分・
 * 住民税分いずれも、`/mortgage-deduction`の試算結果(または`IncomeDeduction`と
 * 同様にDB登録した値)をそのまま「その年に適用される控除額」として受け取り、
 * 本モジュール側では所得税額・住民税所得割額の限度判定(住民税へ繰り越す額の
 * 算出)を再計算しない。控除額が合計税額を上回る場合は0円が下限(還付は生じない)。
 *
 * 源泉徴収税額(`withheldNationalTaxJpy`/`withheldResidentTaxJpy`)は、給与の
 * 源泉徴収税額や、配当等・特定口座(源泉徴収あり)内の株式等譲渡益について
 * 既に源泉徴収(特別徴収)された金額をユーザーが入力すると、上記で求めた
 * 合計税額との差額(納付見込み額・還付見込み額)を追加で試算する任意項目。
 * 未入力(0円)の場合は従来通り年間の税額そのものの概算値のみを返す。
 */

export interface TotalTaxEstimateInput {
  /** 給与所得等、暗号資産雑所得以外の総合課税分の課税所得金額(所得控除後) */
  otherComprehensiveIncomeJpy: Decimal.Value;
  /** 雑所得(暗号資産。現物取引+証拠金取引の決済損益の合計) */
  cryptoMiscIncomeJpy: Decimal.Value;
  /** 譲渡所得(上場株式等・申告分離課税、繰越控除適用後の課税対象額) */
  investmentTaxableGainJpy: Decimal.Value;
  /** 雑所得等(先物取引・FX、申告分離課税、繰越控除適用後の課税対象額) */
  futuresTaxableGainJpy: Decimal.Value;
  /** 配当所得金額(源泉徴収前の年間合計) */
  dividendIncomeJpy: Decimal.Value;
  /** 配当所得の課税方式。未指定の場合は最も税負担が軽い方式を自動選択する */
  dividendMethod?: DividendTaxMethod;
  /** 配当所得(申告分離課税時)と損益通算できる上場株式等の譲渡損失額 */
  availableListedStockLossForDividendJpy?: Decimal.Value;
  /** 住宅ローン控除(税額控除)のうち、その年の所得税額から控除する額 */
  mortgageDeductionNationalTaxCreditJpy?: Decimal.Value;
  /** 住宅ローン控除(税額控除)のうち、その年の住民税額から控除する額 */
  mortgageDeductionResidentTaxCreditJpy?: Decimal.Value;
  /**
   * 既に源泉徴収された所得税及び復興特別所得税の合計額(給与の源泉徴収税額・
   * 配当等の源泉徴収税額・特定口座(源泉徴収あり)内の株式等譲渡益の
   * 源泉徴収税額等)。入力すると合計税額との差額(納付・還付見込み額)を試算する
   */
  withheldNationalTaxJpy?: Decimal.Value;
  /**
   * 既に特別徴収された住民税相当額の合計額(特定口座(源泉徴収あり)内の
   * 株式等譲渡益・配当等について証券会社が徴収した住民税相当額(通常5%)等)
   */
  withheldResidentTaxJpy?: Decimal.Value;
}

export interface TotalTaxEstimateResult {
  /** 総合課税分の課税所得金額(配当所得を除く。給与所得等+暗号資産の雑所得) */
  comprehensiveTaxableIncomeExcludingDividendJpy: Decimal;
  /** 配当所得の課税方式シミュレーション結果(3方式の比較) */
  dividend: DividendTaxSimulationResult;
  /** 合計税額の計算に採用した配当所得の課税方式 */
  dividendMethodUsed: DividendTaxMethod;
  /** `dividend`のうち、`dividendMethodUsed`に対応する結果(呼び出し側の分岐を避けるための参照) */
  dividendResultUsed: DividendTaxMethodResult;
  /** 総合課税分(配当所得を除く)の所得税額(復興特別所得税を含む) */
  comprehensiveNationalTaxJpy: Decimal;
  /** 総合課税分(配当所得を除く)の住民税額 */
  comprehensiveResidentTaxJpy: Decimal;
  /** 株式等の譲渡所得(申告分離課税)の所得税額(復興特別所得税を含む) */
  investmentNationalTaxJpy: Decimal;
  /** 株式等の譲渡所得(申告分離課税)の住民税額 */
  investmentResidentTaxJpy: Decimal;
  /** 先物取引に係る雑所得等(申告分離課税)の所得税額(復興特別所得税を含む) */
  futuresNationalTaxJpy: Decimal;
  /** 先物取引に係る雑所得等(申告分離課税)の住民税額 */
  futuresResidentTaxJpy: Decimal;
  /** 住宅ローン控除適用前の合計の所得税額(復興特別所得税を含む) */
  totalNationalTaxBeforeMortgageDeductionJpy: Decimal;
  /** 住宅ローン控除適用前の合計の住民税額 */
  totalResidentTaxBeforeMortgageDeductionJpy: Decimal;
  /** 実際に適用された住宅ローン控除額(所得税分。入力値と適用前の所得税額のいずれか少ない方) */
  mortgageDeductionNationalTaxAppliedJpy: Decimal;
  /** 実際に適用された住宅ローン控除額(住民税分。入力値と適用前の住民税額のいずれか少ない方) */
  mortgageDeductionResidentTaxAppliedJpy: Decimal;
  /** 合計の所得税額(復興特別所得税を含む。住宅ローン控除適用後) */
  totalNationalTaxJpy: Decimal;
  /** 合計の住民税額(住宅ローン控除適用後) */
  totalResidentTaxJpy: Decimal;
  /** 合計税額(所得税・復興特別所得税・住民税の合計。住宅ローン控除適用後) */
  totalTaxJpy: Decimal;
  /** ふるさと納税(寄附金控除)の年間上限額の試算(自己負担2,000円になる目安) */
  furusatoNozei: FurusatoNozeiLimitResult;
  /** 入力された源泉徴収税額(所得税・復興特別所得税分) */
  withheldNationalTaxJpy: Decimal;
  /** 入力された源泉徴収税額(住民税相当分) */
  withheldResidentTaxJpy: Decimal;
  /** 所得税・復興特別所得税の納付見込み額(正の場合は納付、負の場合は還付) */
  nationalTaxBalanceJpy: Decimal;
  /** 住民税の納付(追加徴収)見込み額(正の場合は追加徴収、負の場合は減額) */
  residentTaxBalanceJpy: Decimal;
  /** 所得税・住民税を合算した納付見込み額(正の場合は納付、負の場合は還付) */
  totalTaxBalanceJpy: Decimal;
  notes: string[];
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateTotalTax(input: TotalTaxEstimateInput): TotalTaxEstimateResult {
  const otherComprehensiveIncomeJpy = new Decimal(input.otherComprehensiveIncomeJpy);
  const cryptoMiscIncomeJpy = new Decimal(input.cryptoMiscIncomeJpy);
  const investmentTaxableGainJpy = new Decimal(input.investmentTaxableGainJpy);
  const futuresTaxableGainJpy = new Decimal(input.futuresTaxableGainJpy);
  const dividendIncomeJpy = new Decimal(input.dividendIncomeJpy);
  const availableListedStockLossForDividendJpy = input.availableListedStockLossForDividendJpy
    ? new Decimal(input.availableListedStockLossForDividendJpy)
    : new Decimal(0);

  requireNonNegative(otherComprehensiveIncomeJpy, "給与所得等の課税所得金額");
  requireNonNegative(cryptoMiscIncomeJpy, "雑所得(暗号資産)");
  requireNonNegative(investmentTaxableGainJpy, "譲渡所得(株式等)");
  requireNonNegative(futuresTaxableGainJpy, "雑所得等(先物取引・FX)");
  requireNonNegative(dividendIncomeJpy, "配当所得金額");
  requireNonNegative(availableListedStockLossForDividendJpy, "損益通算可能な譲渡損失額");

  // 暗号資産の雑所得は他の総合課税所得(給与所得等)と合算した上で
  // 累進税率を適用するため、配当所得のシミュレーションにもこの合算後の
  // 金額を「配当以外の課税所得金額」として渡す(配当を上乗せした場合の
  // 限界税率を正しく計算するため)。
  const comprehensiveTaxableIncomeExcludingDividendJpy =
    otherComprehensiveIncomeJpy.plus(cryptoMiscIncomeJpy);

  const comprehensiveNationalTaxJpy = nationalIncomeTaxWithSurtaxJpy(
    comprehensiveTaxableIncomeExcludingDividendJpy,
  );
  const comprehensiveResidentTaxJpy = comprehensiveTaxableIncomeExcludingDividendJpy.times(
    RESIDENT_TAX_RATE,
  );

  const dividend = simulateDividendTaxation({
    dividendIncomeJpy,
    otherTaxableIncomeJpy: comprehensiveTaxableIncomeExcludingDividendJpy,
    availableListedStockLossJpy: availableListedStockLossForDividendJpy,
  });
  const dividendMethodUsed = input.dividendMethod ?? dividend.recommendedMethod;
  const dividendResult =
    dividendMethodUsed === "COMPREHENSIVE"
      ? dividend.comprehensive
      : dividendMethodUsed === "SEPARATE"
        ? dividend.separate
        : dividend.noFiling;

  const investmentNationalTaxJpy = investmentTaxableGainJpy.times(SEPARATE_NATIONAL_TAX_RATE);
  const investmentResidentTaxJpy = investmentTaxableGainJpy.times(SEPARATE_RESIDENT_TAX_RATE);
  const futuresNationalTaxJpy = futuresTaxableGainJpy.times(SEPARATE_NATIONAL_TAX_RATE);
  const futuresResidentTaxJpy = futuresTaxableGainJpy.times(SEPARATE_RESIDENT_TAX_RATE);

  const totalNationalTaxBeforeMortgageDeductionJpy = comprehensiveNationalTaxJpy
    .plus(dividendResult.nationalTaxJpy)
    .plus(investmentNationalTaxJpy)
    .plus(futuresNationalTaxJpy);
  const totalResidentTaxBeforeMortgageDeductionJpy = comprehensiveResidentTaxJpy
    .plus(dividendResult.residentTaxJpy)
    .plus(investmentResidentTaxJpy)
    .plus(futuresResidentTaxJpy);

  const mortgageDeductionNationalTaxCreditJpy = input.mortgageDeductionNationalTaxCreditJpy
    ? new Decimal(input.mortgageDeductionNationalTaxCreditJpy)
    : new Decimal(0);
  const mortgageDeductionResidentTaxCreditJpy = input.mortgageDeductionResidentTaxCreditJpy
    ? new Decimal(input.mortgageDeductionResidentTaxCreditJpy)
    : new Decimal(0);
  requireNonNegative(mortgageDeductionNationalTaxCreditJpy, "住宅ローン控除額(所得税分)");
  requireNonNegative(mortgageDeductionResidentTaxCreditJpy, "住宅ローン控除額(住民税分)");

  const mortgageDeductionNationalTaxAppliedJpy = Decimal.min(
    mortgageDeductionNationalTaxCreditJpy,
    totalNationalTaxBeforeMortgageDeductionJpy,
  );
  const mortgageDeductionResidentTaxAppliedJpy = Decimal.min(
    mortgageDeductionResidentTaxCreditJpy,
    totalResidentTaxBeforeMortgageDeductionJpy,
  );
  const totalNationalTaxJpy = totalNationalTaxBeforeMortgageDeductionJpy.minus(
    mortgageDeductionNationalTaxAppliedJpy,
  );
  const totalResidentTaxJpy = totalResidentTaxBeforeMortgageDeductionJpy.minus(
    mortgageDeductionResidentTaxAppliedJpy,
  );

  const withheldNationalTaxJpy = input.withheldNationalTaxJpy
    ? new Decimal(input.withheldNationalTaxJpy)
    : new Decimal(0);
  const withheldResidentTaxJpy = input.withheldResidentTaxJpy
    ? new Decimal(input.withheldResidentTaxJpy)
    : new Decimal(0);
  requireNonNegative(withheldNationalTaxJpy, "源泉徴収税額(所得税・復興特別所得税分)");
  requireNonNegative(withheldResidentTaxJpy, "源泉徴収税額(住民税相当分)");
  const nationalTaxBalanceJpy = totalNationalTaxJpy.minus(withheldNationalTaxJpy);
  const residentTaxBalanceJpy = totalResidentTaxJpy.minus(withheldResidentTaxJpy);
  const totalTaxBalanceJpy = nationalTaxBalanceJpy.plus(residentTaxBalanceJpy);

  const notes: string[] = [
    "給与所得等の課税所得金額は所得控除後の金額を入力する前提であり、本ツールは所得控除額を計算しない。",
    "住民税は所得割10%固定の概算であり、均等割・調整控除は含まない。",
    "上場株式等の譲渡所得と先物取引に係る雑所得等は別プールの申告分離課税のため、損益通算はできない。",
  ];
  if (withheldNationalTaxJpy.greaterThan(0) || withheldResidentTaxJpy.greaterThan(0)) {
    notes.push(
      "納付・還付見込み額は入力された源泉徴収税額を単純に差し引いた概算であり、予定納税額との相殺は行っていない。",
    );
    notes.push(
      "特定口座(源泉徴収あり)内の株式等譲渡益・配当等の住民税相当額(通常5%)は、所得税と異なり確定申告時にその場で還付されるものではなく、翌年度の住民税(特別徴収・普通徴収)の額に反映される形で精算される。住民税分の納付・還付見込み額はその概算値であり、実際の精算時期・方法とは異なる。",
    );
  } else {
    notes.push(
      "源泉徴収税額を入力していないため、納付・還付見込み額は年間の税額そのものの概算値と一致する(源泉徴収税額・予定納税額との相殺は行っていない)。",
    );
  }
  if (dividendMethodUsed !== dividend.recommendedMethod) {
    notes.push(
      `配当所得の課税方式に指定された「${dividendMethodUsed}」は、最も税負担が軽い「${dividend.recommendedMethod}」と異なる。`,
    );
  }
  if (mortgageDeductionNationalTaxCreditJpy.greaterThan(0) || mortgageDeductionResidentTaxCreditJpy.greaterThan(0)) {
    notes.push(
      "住宅ローン控除(税額控除)は入力された控除額をそのまま合計税額から差し引いており、所得税額・住民税所得割額の限度判定(住民税へ繰り越す額の算出)は`/mortgage-deduction`の試算結果を前提とする。",
    );
    if (
      mortgageDeductionNationalTaxAppliedJpy.lessThan(mortgageDeductionNationalTaxCreditJpy) ||
      mortgageDeductionResidentTaxAppliedJpy.lessThan(mortgageDeductionResidentTaxCreditJpy)
    ) {
      notes.push(
        "住宅ローン控除額がその年の所得税額・住民税額を上回ったため、超過分は切り捨てて0円を下限とした(還付は生じない)。",
      );
    }
  }

  // ふるさと納税の上限額計算で使う所得税の限界税率は、超過累進税率が適用される
  // 総合課税分の課税所得金額(配当所得を総合課税で選んだ場合はそれも上乗せした金額)に
  // 対応する速算表の税率を用いる(申告分離課税分は税率が別建てのため含めない)。
  // また上限額の算出自体は住宅ローン控除適用前の住民税所得割額を基準とする
  // (住宅ローン控除等の税額控除による変動をふるさと納税上限額の試算に含めない、
  // 既存の簡略化を維持する)。
  const comprehensiveTaxableIncomeForMarginalRateJpy =
    dividendMethodUsed === "COMPREHENSIVE"
      ? comprehensiveTaxableIncomeExcludingDividendJpy.plus(dividendResult.taxableDividendJpy)
      : comprehensiveTaxableIncomeExcludingDividendJpy;
  const totalTaxJpy = totalNationalTaxJpy.plus(totalResidentTaxJpy);
  const furusatoNozei = estimateFurusatoNozeiLimit({
    residentTaxIncomeLeviedJpy: totalResidentTaxBeforeMortgageDeductionJpy,
    marginalIncomeTaxRate: marginalIncomeTaxRate(comprehensiveTaxableIncomeForMarginalRateJpy),
  });

  return {
    comprehensiveTaxableIncomeExcludingDividendJpy,
    dividend,
    dividendMethodUsed,
    dividendResultUsed: dividendResult,
    comprehensiveNationalTaxJpy,
    comprehensiveResidentTaxJpy,
    investmentNationalTaxJpy,
    investmentResidentTaxJpy,
    futuresNationalTaxJpy,
    futuresResidentTaxJpy,
    totalNationalTaxBeforeMortgageDeductionJpy,
    totalResidentTaxBeforeMortgageDeductionJpy,
    mortgageDeductionNationalTaxAppliedJpy,
    mortgageDeductionResidentTaxAppliedJpy,
    totalNationalTaxJpy,
    totalResidentTaxJpy,
    totalTaxJpy,
    furusatoNozei,
    withheldNationalTaxJpy,
    withheldResidentTaxJpy,
    nationalTaxBalanceJpy,
    residentTaxBalanceJpy,
    totalTaxBalanceJpy,
    notes,
  };
}
