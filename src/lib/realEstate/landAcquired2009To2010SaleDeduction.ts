import { Decimal } from "decimal.js";
import { RECONSTRUCTION_SURTAX_RATE } from "../incomeTax";
import { resolveAcquisitionCostJpy } from "./estimatedAcquisitionCost";

/**
 * 平成21年及び22年に取得した国内にある土地等を譲渡した場合の1,000万円特別控除の試算
 * (租税特別措置法35条の2、国税庁タックスアンサーNo.3225「平成21年及び22年に取得した
 * 土地等を譲渡したときの1,000万円の特別控除」)。
 *
 * 特定土地区画整理事業等2,000万円特別控除(`landReadjustmentSaleDeduction.ts`。機能115)・
 * 特定住宅地造成事業等1,500万円特別控除(`housingLandDevelopmentSaleDeduction.ts`。
 * 機能116)と同じ「譲渡所得の特別控除の種類」(国税庁タックスアンサーNo.3223)の系統だが、
 * 公共事業等のための買取りではなく、平成21年(2009年)1月1日から平成22年(2010年)
 * 12月31日までの間に取得した国内にある土地等を、取得した年の1月1日から引き続き
 * 所有期間が5年を超える年に譲渡した場合という取得時期そのものを要件とする点が異なる。
 * この要件(取得年の1月1日起算で所有期間5年超の年の譲渡であること)は制度の構造上、
 * 必然的に長期譲渡所得のみが対象になる(措置法34条・34条の2とは異なり短期譲渡所得には
 * 適用されない)。
 *
 * **適用要件(本ツールでは判定を行わず、`specialDeductionEligible`としてユーザー自身の
 * 確認事項とする。国税庁タックスアンサーNo.3225を一次情報として要約):**
 *  - 平成21年1月1日から平成22年12月31日までの間に土地等を取得したこと。
 *  - その取得をした年の1月1日から引き続き所有期間が5年を超える年に譲渡すること
 *    (平成21年取得分は平成27年(2015年)以後、平成22年取得分は平成28年(2016年)以後の
 *    譲渡が対象)。
 *  - 親子・夫婦等の特別な関係がある者からの取得でないこと。
 *  - 相続・遺贈・贈与・交換・代物弁済・所有権移転外リース取引による取得でないこと。
 *  - 控除限度額(1,000万円)は土地等1筆ごとではなく、その年に譲渡した対象土地等の
 *    譲渡益の合計に対して年単位で1,000万円が上限(本ツールは1筆単位の単体試算画面のため、
 *    複数筆をまとめて譲渡する場合は按分後の金額をユーザー自身で入力する)。
 *
 * 措置法34条(機能115)・34条の2(機能116)と同様、収用等5,000万円特別控除・居住用財産
 * 3,000万円特別控除等、他の土地建物の特別控除と同一年に重複して適用する場合は
 * 措置法36条により年間合計5,000万円が限度となる(この年間合計限度額の調整は
 * 引き続き対象外)。
 *
 * **本ツールが試算しない範囲(今後の課題):**
 *  - 上記の適用要件(取得時期・取得原因・特別関係者からの取得でないこと)の判定は行わず、
 *    `specialDeductionEligible`としてユーザー自身が確認したうえで入力するチェック項目
 *    とする(機能113・115・116と同様の方針)。
 *  - 同一年中に複数筆の対象土地等を譲渡した場合の1,000万円限度額の按分計算は対象外。
 *  - 他の土地建物の特別控除との年間合計5,000万円限度額(措法36)の調整は行わない。
 *  - 取得費が不明な場合の概算取得費(譲渡価額の5%。措置法31条の4、国税庁タックス
 *    アンサーNo.3258)は`useEstimatedAcquisitionCost`をtrueにすると、
 *    `acquisitionCostJpy`(不明な場合は0円)と5%相当額の高い方を自動採用する
 *    (`estimatedAcquisitionCost.ts`参照。機能113・115・116と同様の方針)。
 */

const SHORT_TERM_MAX_OWNERSHIP_YEARS = 5;

const SPECIAL_DEDUCTION_LIMIT_JPY = new Decimal(10_000_000);

// 短期譲渡所得(所有期間5年以下)の税率
const SHORT_TERM_NATIONAL_TAX_RATE = 0.3 * (1 + RECONSTRUCTION_SURTAX_RATE);
const SHORT_TERM_RESIDENT_TAX_RATE = 0.09;
// 長期譲渡所得(所有期間5年超)の税率
const LONG_TERM_NATIONAL_TAX_RATE = 0.15 * (1 + RECONSTRUCTION_SURTAX_RATE);
const LONG_TERM_RESIDENT_TAX_RATE = 0.05;

export type HoldingPeriodCategory = "SHORT_TERM" | "LONG_TERM";

export interface LandAcquired2009To2010SaleDeductionInput {
  /** 譲渡価額 */
  transferPriceJpy: Decimal.Value;
  /** 取得費(取得価額-減価償却費相当額等。不明な場合は0円を入力し、下のuseEstimatedAcquisitionCostで概算取得費を使う) */
  acquisitionCostJpy: Decimal.Value;
  /** 譲渡費用(仲介手数料・印紙税等) */
  transferExpensesJpy: Decimal.Value;
  /**
   * 取得費が不明、または譲渡価額の5%相当額を下回る場合に、概算取得費の特例
   * (措置法31条の4)により譲渡価額の5%相当額を取得費として使うか(省略時false)。
   */
  useEstimatedAcquisitionCost?: boolean;
  /** 譲渡した年の1月1日時点の所有期間(年)。5年以下は短期、5年超は長期譲渡所得 */
  ownershipYears: number;
  /**
   * 平成21年及び22年取得分の1,000万円特別控除(措置法35条の2)の要件(平成21年1月1日
   * から平成22年12月31日までの間に取得したこと、特別な関係がある者からの取得・相続や
   * 贈与等による取得でないこと等)を満たすか(ユーザー自身の確認事項)
   */
  specialDeductionEligible: boolean;
}

export interface LandAcquired2009To2010SaleDeductionResult {
  /** 実際に計算に採用した取得費(概算取得費を適用した場合はその金額) */
  acquisitionCostJpy: Decimal;
  /** 概算取得費(譲渡価額の5%相当額。参考表示用に常に計算する) */
  estimatedAcquisitionCostJpy: Decimal;
  /** 概算取得費の特例が実際に適用されたか */
  estimatedAcquisitionCostApplied: boolean;
  /** 特別控除適用前の譲渡所得の金額(譲渡価額-(取得費+譲渡費用)) */
  transferGainJpy: Decimal;
  holdingPeriodCategory: HoldingPeriodCategory;
  /** 実際に適用された1,000万円特別控除額(譲渡益が1,000万円未満の場合はその金額が上限) */
  specialDeductionAppliedJpy: Decimal;
  /** 特別控除後の課税譲渡所得金額 */
  taxableGainJpy: Decimal;
  nationalTaxJpy: Decimal;
  residentTaxJpy: Decimal;
  totalTaxJpy: Decimal;
  notes: string[];
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function simulateLandAcquired2009To2010SaleDeduction(
  input: LandAcquired2009To2010SaleDeductionInput,
): LandAcquired2009To2010SaleDeductionResult {
  const transferPriceJpy = new Decimal(input.transferPriceJpy);
  const transferExpensesJpy = new Decimal(input.transferExpensesJpy);

  requireNonNegative(transferPriceJpy, "譲渡価額");
  requireNonNegative(transferExpensesJpy, "譲渡費用");
  if (!Number.isInteger(input.ownershipYears) || input.ownershipYears < 0) {
    throw new Error("所有期間(年)は0以上の整数である必要があります");
  }

  const acquisitionCostResolution = resolveAcquisitionCostJpy({
    actualAcquisitionCostJpy: input.acquisitionCostJpy,
    transferPriceJpy,
    useEstimated: input.useEstimatedAcquisitionCost ?? false,
  });
  const acquisitionCostJpy = acquisitionCostResolution.acquisitionCostJpy;

  const transferGainJpy = transferPriceJpy.minus(acquisitionCostJpy).minus(transferExpensesJpy);
  const holdingPeriodCategory: HoldingPeriodCategory =
    input.ownershipYears > SHORT_TERM_MAX_OWNERSHIP_YEARS ? "LONG_TERM" : "SHORT_TERM";

  const notes: string[] = [
    "租税特別措置法35条の2(平成21年及び22年に取得した土地等を譲渡した場合の1,000万円特別控除。国税庁タックスアンサーNo.3225)に基づく概算値。取得時期(平成21年1月1日〜平成22年12月31日)・取得原因(特別な関係がある者からの取得や相続・贈与等による取得でないこと)等の適用要件の判定は行わないため、必ず国税庁の解説等で自身の適用可否を確認すること。",
    "この特別控除は、取得をした年の1月1日から引き続き所有期間が5年を超える年に譲渡した場合(必然的に長期譲渡所得)のみが対象で、短期譲渡所得(所有期間5年以下)には適用できない。",
    "所有期間は譲渡した年の1月1日時点で判定する(実際の保有期間ではない点に注意)。5年以下は短期譲渡所得(税率合計39.63%)、5年超は長期譲渡所得(税率合計20.315%)。",
    "控除限度額(1,000万円)は土地等1筆ごとではなく、その年に譲渡した対象土地等の譲渡益の合計に対して年単位で1,000万円が上限。複数筆をまとめて譲渡する場合は按分後の金額を入力すること。",
    "収用等の5,000万円特別控除(措置法33条の4)・居住用財産の3,000万円特別控除(措置法35条)・特定土地区画整理事業等の2,000万円特別控除(措置法34条)・特定住宅地造成事業等の1,500万円特別控除(措置法34条の2)等、他の土地建物の特別控除と同一年に重複して適用する場合、特別控除額はその年の譲渡益全体を通じて合計5,000万円が限度となる(措法36)。この年間合計限度額の調整は行わない。",
    ...acquisitionCostResolution.notes,
  ];

  if (transferGainJpy.lessThanOrEqualTo(0)) {
    notes.push("譲渡損失(譲渡価額が取得費・譲渡費用の合計以下)のため税額は生じない。");
    return {
      acquisitionCostJpy,
      estimatedAcquisitionCostJpy: acquisitionCostResolution.estimatedAcquisitionCostJpy,
      estimatedAcquisitionCostApplied: acquisitionCostResolution.estimatedApplied,
      transferGainJpy,
      holdingPeriodCategory,
      specialDeductionAppliedJpy: new Decimal(0),
      taxableGainJpy: new Decimal(0),
      nationalTaxJpy: new Decimal(0),
      residentTaxJpy: new Decimal(0),
      totalTaxJpy: new Decimal(0),
      notes,
    };
  }

  let specialDeductionAppliedJpy = new Decimal(0);
  if (!input.specialDeductionEligible) {
    notes.push("1,000万円特別控除は未適用として試算した(specialDeductionEligible=false)。");
  } else if (holdingPeriodCategory === "SHORT_TERM") {
    notes.push(
      "所有期間が5年以下(短期譲渡所得)のため、平成21年及び22年取得分の1,000万円特別控除(措置法35条の2)は適用できず未適用として試算した。",
    );
  } else {
    specialDeductionAppliedJpy = Decimal.min(transferGainJpy, SPECIAL_DEDUCTION_LIMIT_JPY);
  }

  const taxableGainJpy = transferGainJpy.minus(specialDeductionAppliedJpy);

  const nationalRate =
    holdingPeriodCategory === "LONG_TERM" ? LONG_TERM_NATIONAL_TAX_RATE : SHORT_TERM_NATIONAL_TAX_RATE;
  const residentRate =
    holdingPeriodCategory === "LONG_TERM" ? LONG_TERM_RESIDENT_TAX_RATE : SHORT_TERM_RESIDENT_TAX_RATE;

  const nationalTaxJpy = taxableGainJpy.times(nationalRate);
  const residentTaxJpy = taxableGainJpy.times(residentRate);

  return {
    acquisitionCostJpy,
    estimatedAcquisitionCostJpy: acquisitionCostResolution.estimatedAcquisitionCostJpy,
    estimatedAcquisitionCostApplied: acquisitionCostResolution.estimatedApplied,
    transferGainJpy,
    holdingPeriodCategory,
    specialDeductionAppliedJpy,
    taxableGainJpy,
    nationalTaxJpy,
    residentTaxJpy,
    totalTaxJpy: nationalTaxJpy.plus(residentTaxJpy),
    notes,
  };
}
