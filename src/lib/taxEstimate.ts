import { Decimal } from "decimal.js";
import {
  RESIDENT_TAX_RATE,
  SEPARATE_NATIONAL_TAX_RATE,
  SEPARATE_RESIDENT_TAX_RATE,
  nationalIncomeTaxWithSurtaxJpy,
} from "./incomeTax";
import {
  simulateDividendTaxation,
  type DividendTaxMethod,
  type DividendTaxMethodResult,
  type DividendTaxSimulationResult,
} from "./investment/dividendTaxSimulation";

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
  /** 合計の所得税額(復興特別所得税を含む) */
  totalNationalTaxJpy: Decimal;
  /** 合計の住民税額 */
  totalResidentTaxJpy: Decimal;
  /** 合計税額(所得税・復興特別所得税・住民税の合計) */
  totalTaxJpy: Decimal;
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

  const totalNationalTaxJpy = comprehensiveNationalTaxJpy
    .plus(dividendResult.nationalTaxJpy)
    .plus(investmentNationalTaxJpy)
    .plus(futuresNationalTaxJpy);
  const totalResidentTaxJpy = comprehensiveResidentTaxJpy
    .plus(dividendResult.residentTaxJpy)
    .plus(investmentResidentTaxJpy)
    .plus(futuresResidentTaxJpy);

  const notes: string[] = [
    "給与所得等の課税所得金額は所得控除後の金額を入力する前提であり、本ツールは所得控除額を計算しない。",
    "住民税は所得割10%固定の概算であり、均等割・調整控除は含まない。",
    "源泉徴収税額・予定納税額との相殺は行っておらず、ここで求めているのは年間の税額そのものの概算値(納付額・還付額ではない)。",
    "上場株式等の譲渡所得と先物取引に係る雑所得等は別プールの申告分離課税のため、損益通算はできない。",
  ];
  if (dividendMethodUsed !== dividend.recommendedMethod) {
    notes.push(
      `配当所得の課税方式に指定された「${dividendMethodUsed}」は、最も税負担が軽い「${dividend.recommendedMethod}」と異なる。`,
    );
  }

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
    totalNationalTaxJpy,
    totalResidentTaxJpy,
    totalTaxJpy: totalNationalTaxJpy.plus(totalResidentTaxJpy),
    notes,
  };
}
