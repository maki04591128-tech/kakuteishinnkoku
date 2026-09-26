import { Decimal } from "decimal.js";
import { RECONSTRUCTION_SURTAX_RATE } from "../incomeTax";
import { resolveAcquisitionCostJpy } from "./estimatedAcquisitionCost";

/**
 * 低未利用土地等を譲渡した場合の長期譲渡所得の100万円特別控除の試算
 * (租税特別措置法35条の3、国税庁タックスアンサーNo.3223「譲渡所得の特別控除の種類」)。
 *
 * 機能115〜118(特定土地区画整理事業等2,000万円・特定住宅地造成事業等1,500万円・
 * 平成21/22年取得分1,000万円・農地保有の合理化等800万円の各特別控除)と同じ
 * 「譲渡所得の特別控除の種類」の系統に属する最後の1類型で、公共事業等のための
 * 買取りや特定の取得時期を要件とする他の類型とは異なり、譲渡した土地等自体が
 * 「低未利用土地等」(居住・事業その他の用途に利用されていない、または周辺地域の
 * 同一用途の土地と比べて利用の程度が著しく劣る土地)であることを要件とする。
 *
 * **主な適用要件(措置法35条の3第1項各号。国税庁タックスアンサー・複数の自治体
 * 公式ページ(横浜市・高崎市等)を一次情報として要約):**
 *  - 譲渡した年の1月1日において所有期間が5年を超えること(機能117の平成21/22年
 *    取得分1,000万円特別控除と同様、制度の性質上、長期譲渡所得のみが対象で
 *    短期譲渡所得には適用できない)。
 *  - 譲渡した土地等の上にある建物等の対価を含めた譲渡価額が500万円以下であること。
 *    ただし、令和5年度税制改正(令和5年1月1日〜令和10年12月31日の譲渡に適用)により、
 *    市街化区域・非線引き都市計画区域内の用途地域設定区域・所有者不明土地対策計画を
 *    策定した市区町村の区域内等にある低未利用土地等については、この上限が800万円に
 *    引き上げられている。
 *  - 譲渡した相手方が、配偶者・直系血族・生計を一にする親族等、譲渡者と特別の関係が
 *    ある者でないこと。
 *  - 都市計画区域内にある土地等であり、譲渡後に土地等の利用がされること(駐車場等の
 *    用途は対象外とする自治体の運用が一般的)。
 *  - 同一の所有者から前年又は前々年に分筆された土地等について、既にこの特別控除の
 *    適用を受けていないこと。
 *  - 他の譲渡所得の特別控除(収用等5,000万円・居住用財産3,000万円等)の適用を
 *    受けていないこと。
 *
 * 上記のうち、譲渡価額の上限(500万円/800万円)判定は本ツールでも自動判定できる
 * 具体的な金額基準であるため、`inSpecialLowUtilizationArea`(市街化区域等の該当有無)を
 * 入力させ、実際の譲渡価額と比較して超過する場合は自動的に特別控除を不適用とする。
 * それ以外の要件(特別の関係の有無・譲渡後の利用・分筆履歴・他の特別控除との重複)は
 * 機能113・115〜118と同様、`specialDeductionEligible`としてユーザー自身の確認事項とする。
 *
 * **本ツールが試算しない範囲(今後の課題):**
 *  - 同一年中に複数の低未利用土地等をこの特例の対象として譲渡した場合、500万円/800万円の
 *    判定はそれらの対価の額を合計して行う必要があるが、本ツールは1筆単位の単体試算画面の
 *    ため、合算後の金額をユーザー自身が`transferPriceJpy`に入力する前提とする。
 *  - 上記の適用要件のうち、特別の関係の有無・譲渡後の利用実績・分筆履歴・他の特別控除との
 *    重複適用の判定は行わない(`specialDeductionEligible`としてユーザー自身が確認する)。
 *  - 他の土地建物の特別控除と同一年に重複して適用する場合の年間合計5,000万円限度額
 *    (措法36)の調整は行わない。
 *  - 取得費が不明な場合の概算取得費(譲渡価額の5%。措置法31条の4、国税庁タックス
 *    アンサーNo.3258)は`useEstimatedAcquisitionCost`をtrueにすると、
 *    `acquisitionCostJpy`(不明な場合は0円)と5%相当額の高い方を自動採用する
 *    (`estimatedAcquisitionCost.ts`参照。機能113・115〜118と同様の方針)。
 */

const SHORT_TERM_MAX_OWNERSHIP_YEARS = 5;

const SPECIAL_DEDUCTION_LIMIT_JPY = new Decimal(1_000_000);
const STANDARD_PRICE_LIMIT_JPY = new Decimal(5_000_000);
const SPECIAL_AREA_PRICE_LIMIT_JPY = new Decimal(8_000_000);

// 短期譲渡所得(所有期間5年以下)の税率
const SHORT_TERM_NATIONAL_TAX_RATE = 0.3 * (1 + RECONSTRUCTION_SURTAX_RATE);
const SHORT_TERM_RESIDENT_TAX_RATE = 0.09;
// 長期譲渡所得(所有期間5年超)の税率
const LONG_TERM_NATIONAL_TAX_RATE = 0.15 * (1 + RECONSTRUCTION_SURTAX_RATE);
const LONG_TERM_RESIDENT_TAX_RATE = 0.05;

export type HoldingPeriodCategory = "SHORT_TERM" | "LONG_TERM";

export interface LowUtilizationLandSaleDeductionInput {
  /** 譲渡価額(土地等の上にある建物等の対価を含む) */
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
   * 譲渡した低未利用土地等が、市街化区域・非線引き都市計画区域内の用途地域設定区域・
   * 所有者不明土地対策計画を策定した市区町村の区域内等(令和5年度税制改正による
   * 譲渡価額上限800万円の対象区域)に所在するか。falseの場合は上限500万円で判定する。
   */
  inSpecialLowUtilizationArea?: boolean;
  /**
   * 低未利用土地等の100万円特別控除(措置法35条の3)のうち、譲渡価額の上限
   * (500万円/800万円)以外の要件(特別の関係がある者への譲渡でないこと、都市計画
   * 区域内にあり譲渡後に利用されること、分筆履歴、他の特別控除との重複適用でないこと等)を
   * 満たすか(ユーザー自身の確認事項)
   */
  specialDeductionEligible: boolean;
}

export interface LowUtilizationLandSaleDeductionResult {
  /** 実際に計算に採用した取得費(概算取得費を適用した場合はその金額) */
  acquisitionCostJpy: Decimal;
  /** 概算取得費(譲渡価額の5%相当額。参考表示用に常に計算する) */
  estimatedAcquisitionCostJpy: Decimal;
  /** 概算取得費の特例が実際に適用されたか */
  estimatedAcquisitionCostApplied: boolean;
  /** 特別控除適用前の譲渡所得の金額(譲渡価額-(取得費+譲渡費用)) */
  transferGainJpy: Decimal;
  holdingPeriodCategory: HoldingPeriodCategory;
  /** 譲渡価額上限(500万円または800万円。inSpecialLowUtilizationAreaにより判定) */
  priceLimitJpy: Decimal;
  /** 譲渡価額が上限を超えているか(超えている場合は特別控除の対象外) */
  priceLimitExceeded: boolean;
  /** 実際に適用された100万円特別控除額(譲渡益が100万円未満の場合はその金額が上限) */
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

export function simulateLowUtilizationLandSaleDeduction(
  input: LowUtilizationLandSaleDeductionInput,
): LowUtilizationLandSaleDeductionResult {
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

  const priceLimitJpy = input.inSpecialLowUtilizationArea
    ? SPECIAL_AREA_PRICE_LIMIT_JPY
    : STANDARD_PRICE_LIMIT_JPY;
  const priceLimitExceeded = transferPriceJpy.greaterThan(priceLimitJpy);

  const notes: string[] = [
    "租税特別措置法35条の3(低未利用土地等を譲渡した場合の長期譲渡所得の100万円特別控除。国税庁タックスアンサーNo.3223)に基づく概算値。特別の関係がある者への譲渡でないこと、都市計画区域内にあり譲渡後に利用されること、分筆履歴、他の特別控除との重複適用でないこと等の適用要件の判定は行わないため、必ず国税庁の解説等で自身の適用可否を確認すること。",
    `譲渡価額(建物等の対価を含む)の上限は、市街化区域等(令和5年度税制改正による特例区域)の場合800万円、それ以外は500万円。今回は${priceLimitJpy.toNumber().toLocaleString("ja-JP")}円を上限として判定した。`,
    "この特別控除は所有期間が5年を超える年に譲渡した場合(長期譲渡所得)のみが対象で、短期譲渡所得(所有期間5年以下)には適用できない。",
    "所有期間は譲渡した年の1月1日時点で判定する(実際の保有期間ではない点に注意)。5年以下は短期譲渡所得(税率合計39.63%)、5年超は長期譲渡所得(税率合計20.315%)。",
    "同一年中に複数の低未利用土地等をこの特例の対象として譲渡した場合、譲渡価額の上限判定はそれらの対価の額を合計して行う必要がある(本ツールは1筆単位の試算のため、合算後の金額をtransferPriceJpyに入力すること)。",
    "収用等の5,000万円特別控除(措置法33条の4)・居住用財産の3,000万円特別控除(措置法35条)・特定土地区画整理事業等の2,000万円特別控除(措置法34条)・特定住宅地造成事業等の1,500万円特別控除(措置法34条の2)・平成21/22年取得分の1,000万円特別控除(措置法35条の2)・農地保有の合理化等の800万円特別控除(措置法34条の3)等、他の土地建物の特別控除と同一年に重複して適用する場合、特別控除額はその年の譲渡益全体を通じて合計5,000万円が限度となる(措法36)。この年間合計限度額の調整は行わない。",
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
      priceLimitJpy,
      priceLimitExceeded,
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
    notes.push("100万円特別控除は未適用として試算した(specialDeductionEligible=false)。");
  } else if (holdingPeriodCategory === "SHORT_TERM") {
    notes.push(
      "所有期間が5年以下(短期譲渡所得)のため、低未利用土地等の100万円特別控除(措置法35条の3)は適用できず未適用として試算した。",
    );
  } else if (priceLimitExceeded) {
    notes.push(
      `譲渡価額(${transferPriceJpy.toNumber().toLocaleString("ja-JP")}円)が上限(${priceLimitJpy.toNumber().toLocaleString("ja-JP")}円)を超えるため、低未利用土地等の100万円特別控除(措置法35条の3)は適用できず未適用として試算した。`,
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
    priceLimitJpy,
    priceLimitExceeded,
    specialDeductionAppliedJpy,
    taxableGainJpy,
    nationalTaxJpy,
    residentTaxJpy,
    totalTaxJpy: nationalTaxJpy.plus(residentTaxJpy),
    notes,
  };
}
