import { Decimal } from "decimal.js";
import { RECONSTRUCTION_SURTAX_RATE } from "../incomeTax";
import { resolveAcquisitionCostJpy } from "./estimatedAcquisitionCost";

/**
 * 農地保有の合理化等のために農地等を売った場合の800万円特別控除の試算
 * (租税特別措置法34条の3、国税庁タックスアンサーNo.3223「譲渡所得の特別控除の種類」)。
 *
 * 特定土地区画整理事業等2,000万円特別控除(`landReadjustmentSaleDeduction.ts`。機能115)・
 * 特定住宅地造成事業等1,500万円特別控除(`housingLandDevelopmentSaleDeduction.ts`。機能116)と
 * 同じ「譲渡所得の特別控除の種類」(国税庁タックスアンサーNo.3223)の系統だが、公共事業等の
 * ための買取りではなく、農地保有の合理化・林地保有の合理化に資する譲渡であることを要件と
 * する点が異なる。措置法34条の3の条文本文(第1項)を確認したところ、控除額は常に800万円
 * 一律であり(MAFF(農林水産省)の解説資料等に見られる1,500万円・2,000万円という高額の
 * 控除は、農地中間管理機構への買入協議・地域農業経営基盤強化促進計画の特例による譲渡が
 * それぞれ措置法34条(機能115)・34条の2(機能116)側の号に別途該当する場合の金額であり、
 * 措置法34条の3自体の控除額ではないことを条文の除外規定(「第三十四条第二項第七号又は
 * 前条第二項第二十五号の規定の適用がある場合を除く」)から確認した)。
 *
 * **主な適用要件(措置法34条の3第2項各号。ユーザー自身の確認事項として
 * `specialDeductionEligible`にまとめて入力する。条文本文を一次情報として要約):**
 *  - 農業振興地域の整備に関する法律23条の勧告に係る協議・調停・あっせん等により
 *    土地等を譲渡した場合(政令で定める場合を含む)。
 *  - 農用地区域内にある土地等を、農地中間管理事業の推進に関する法律に基づく
 *    公告があった農用地利用集積等促進計画の定めるところにより譲渡した場合
 *    (農地中間管理機構への譲渡等)。
 *  - 農村地域への産業の導入の促進等に関する法律に基づく実施計画の産業導入地区内の
 *    農用地等を、施設用地の用に供するため譲渡した場合。
 *  - 土地改良法の土地改良事業(換地処分)に伴い、一定の清算金を取得する場合。
 *  - 林業経営の規模拡大・林地の集団化等の林地保有の合理化に資するため、森林組合等に
 *    委託して地域森林計画の対象山林に係る土地を譲渡した場合。
 *  - 農業振興地域の整備に関する法律の事業(換地処分)に伴い、一定の清算金を取得する場合。
 *  - 農地中間管理機構への買入協議による譲渡・地域農業経営基盤強化促進計画の特例による
 *    譲渡等、措置法34条・34条の2側でより高額の特別控除(2,000万円・1,500万円)の対象と
 *    なる場合は、本特例(措置法34条の3)の対象から除かれる(条文本文の除外規定)。
 *  - 確定申告書に本特例の適用を受ける旨の記載があり、かつ該当する旨を証する書類
 *    (財務省令で定めるもの)の添付が要件(措置法34条の3第3項)。
 *
 * 措置法34条・34条の2と同様、所有期間(短期・長期)を問わず適用でき、短期・長期譲渡所得の
 * 税率区分自体は他の土地建物の譲渡所得と同じ(措置法32条・31条)ため、
 * `expropriationSaleTaxSimulation.ts`と同じ税率定数を用いる。措置法34条・34条の2に
 * ある「同一の事業のための買取りが2以上の年にわたる場合は最初の年の買取りにのみ適用」
 * という制限は、条文本文を確認した限り措置法34条の3には存在しない(対象となる譲渡の
 * 性質(あっせん・清算金の取得等)が公共事業等の複数年买取りとは異なるため)。
 *
 * **本ツールが試算しない範囲(今後の課題):**
 *  - 上記の適用要件(対象となる譲渡の類型・確定申告書への記載及び証明書類の添付)の判定は
 *    行わず、`specialDeductionEligible`としてユーザー自身が確認したうえで入力する
 *    チェック項目とする(機能113・115・116と同様の方針)。
 *  - 他の土地建物の特別控除(収用等5,000万円・居住用財産3,000万円等)と同一年に重複して
 *    適用する場合の年間合計5,000万円限度額(措法36)の調整は行わない(本ツールは単一の
 *    特例の試算に特化しており、複数の特別控除の組み合わせはユーザー自身の確認事項とする)。
 *  - 取得費が不明な場合の概算取得費(譲渡価額の5%。措置法31条の4、国税庁タックス
 *    アンサーNo.3258)は`useEstimatedAcquisitionCost`をtrueにすると、
 *    `acquisitionCostJpy`(不明な場合は0円)と5%相当額の高い方を自動採用する
 *    (`estimatedAcquisitionCost.ts`参照。機能113・115・116と同様の方針)。
 */

const SHORT_TERM_MAX_OWNERSHIP_YEARS = 5;

const SPECIAL_DEDUCTION_LIMIT_JPY = new Decimal(8_000_000);

// 短期譲渡所得(所有期間5年以下)の税率
const SHORT_TERM_NATIONAL_TAX_RATE = 0.3 * (1 + RECONSTRUCTION_SURTAX_RATE);
const SHORT_TERM_RESIDENT_TAX_RATE = 0.09;
// 長期譲渡所得(所有期間5年超)の税率
const LONG_TERM_NATIONAL_TAX_RATE = 0.15 * (1 + RECONSTRUCTION_SURTAX_RATE);
const LONG_TERM_RESIDENT_TAX_RATE = 0.05;

export type HoldingPeriodCategory = "SHORT_TERM" | "LONG_TERM";

export interface AgriculturalLandRationalizationSaleDeductionInput {
  /** 譲渡価額(買取り代金・清算金等) */
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
   * 農地保有の合理化等のための800万円特別控除(措置法34条の3)の要件(対象となる譲渡の
   * 類型に該当すること、確定申告書への記載及び証明書類の添付等)を満たすか
   * (ユーザー自身の確認事項)
   */
  specialDeductionEligible: boolean;
}

export interface AgriculturalLandRationalizationSaleDeductionResult {
  /** 実際に計算に採用した取得費(概算取得費を適用した場合はその金額) */
  acquisitionCostJpy: Decimal;
  /** 概算取得費(譲渡価額の5%相当額。参考表示用に常に計算する) */
  estimatedAcquisitionCostJpy: Decimal;
  /** 概算取得費の特例が実際に適用されたか */
  estimatedAcquisitionCostApplied: boolean;
  /** 特別控除適用前の譲渡所得の金額(譲渡価額-(取得費+譲渡費用)) */
  transferGainJpy: Decimal;
  holdingPeriodCategory: HoldingPeriodCategory;
  /** 実際に適用された800万円特別控除額(譲渡益が800万円未満の場合はその金額が上限) */
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

export function simulateAgriculturalLandRationalizationSaleDeduction(
  input: AgriculturalLandRationalizationSaleDeductionInput,
): AgriculturalLandRationalizationSaleDeductionResult {
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
    "租税特別措置法34条の3(農地保有の合理化等のために農地等を譲渡した場合の800万円特別控除。国税庁タックスアンサーNo.3223)に基づく概算値。対象となる譲渡の類型(あっせん・農地中間管理機構への譲渡・清算金の取得等)、確定申告書への記載及び証明書類の添付等の適用要件の判定は行わないため、必ず国税庁の解説等で自身の適用可否を確認すること。",
    "農地中間管理機構への買入協議による譲渡(1,500万円。措置法34条)・地域農業経営基盤強化促進計画の特例による譲渡(2,000万円。措置法34条の2)は、より高額な別の特別控除の対象であり本特例(800万円)の対象から除かれる。該当する場合は特定土地区画整理事業等2,000万円特別控除・特定住宅地造成事業等1,500万円特別控除の試算画面を利用すること。",
    "所有期間は譲渡した年の1月1日時点で判定する(実際の保有期間ではない点に注意)。5年以下は短期譲渡所得(税率合計39.63%)、5年超は長期譲渡所得(税率合計20.315%)。",
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

  const specialDeductionAppliedJpy = input.specialDeductionEligible
    ? Decimal.min(transferGainJpy, SPECIAL_DEDUCTION_LIMIT_JPY)
    : new Decimal(0);
  if (!input.specialDeductionEligible) {
    notes.push("800万円特別控除は未適用として試算した(specialDeductionEligible=false)。");
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
