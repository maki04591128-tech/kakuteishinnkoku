import { Decimal } from "decimal.js";
import { RECONSTRUCTION_SURTAX_RATE } from "../incomeTax";
import { resolveAcquisitionCostJpy } from "./estimatedAcquisitionCost";

/**
 * 特定住宅地造成事業等のために土地等を売った場合の1,500万円特別控除の試算
 * (租税特別措置法34条の2、国税庁タックスアンサーNo.3223「譲渡所得の特別控除の種類」)。
 *
 * 特定土地区画整理事業等のための2,000万円特別控除(`landReadjustmentSaleDeduction.ts`。
 * 機能115)と同じ「公共事業等のために土地等を売った場合の特別控除」の系統だが、対象と
 * なる事業の種類・控除額(1,500万円)が異なる。措置法34条の2第2項各号(25号まで)の
 * うち、本ツールでは適用要件の判定自体は行わず(既存パターンと同様、
 * `specialDeductionEligible`としてユーザー自身の確認事項とする)、控除額(1,500万円)と
 * 多年度買取りの制限、および1つの号(3号)にのみ存在する期限切れの注意点のみを扱う。
 *
 * **対象となる買取りの主体・種類(措置法34条の2第2項各号。ユーザー自身の確認事項として
 * `specialDeductionEligible`にまとめて入力する。租税特別措置法の条文・国税庁タックス
 * アンサーNo.3223を一次情報として要約):**
 *  - 地方公共団体・独立行政法人都市再生機構・地方住宅供給公社・日本勤労者住宅協会等が
 *    行う住宅建設または宅地造成の事業のために土地等が買い取られた場合(1号)。
 *  - 土地収用法等に基づく収用や、地方公共団体等による公営住宅の用地としての買取り(2号)。
 *  - 独立行政法人都市再生機構等が行う一団の宅地造成事業で、その造成する宅地の面積が
 *    1,000㎡(3大都市圏の一定区域は500㎡)以上のもののために買い取られた場合(3号。
 *    **平成6年1月1日から令和5年12月31日までの間の譲渡に限られる時限措置のため、
 *    令和6年(2024年)以後の譲渡には適用できない**)。
 *  - 公有地の拡大の推進に関する法律に基づく買取り(4号)。
 *  - 密集市街地における防災街区の整備の促進に関する法律・中心市街地の活性化に関する
 *    法律・都市再生特別措置法等に基づく事業のための買取り(5号〜11号)。
 *  - 農業経営基盤強化促進法・生産緑地法・農地中間管理事業の推進に関する法律等に基づく
 *    買取り(12号〜17号等)。
 *  - 土地区画整理法・マンションの建替え等の円滑化に関する法律等に基づく買取り
 *    (18号〜25号等)。
 *  - 同一の事業のための買取りが2以上の年にわたる場合、本特別控除は最初の年の
 *    買取りにのみ適用され、2年目以降の買取りには適用されない(措法34条の2第4項)。
 *
 * 措置法34条(特定土地区画整理事業等。機能115)と同様、所有期間(短期・長期)を問わず
 * 適用できるため、税率区分自体は他の土地建物の譲渡所得と同じ(措置法32条・31条)。
 *
 * **本ツールが試算しない範囲(今後の課題):**
 *  - 上記の適用要件(買取りの主体・種類の号、3号の期限、同一事業の買取りが2年以上に
 *    わたる場合の「最初の年」判定)の判定は行わず、`specialDeductionEligible`として
 *    ユーザー自身が確認したうえで入力するチェック項目とする(機能113・115と同様の方針)。
 *  - 他の土地建物の特別控除(収用等5,000万円・居住用財産3,000万円・特定土地区画整理
 *    事業等2,000万円等)と同一年に重複して適用する場合の年間合計5,000万円限度額
 *    (措法36)の調整は行わない。
 *  - 取得費が不明な場合の概算取得費(譲渡価額の5%。措置法31条の4、国税庁タックス
 *    アンサーNo.3258)は`useEstimatedAcquisitionCost`をtrueにすると、
 *    `acquisitionCostJpy`(不明な場合は0円)と5%相当額の高い方を自動採用する
 *    (`estimatedAcquisitionCost.ts`参照。機能113・115と同様の方針)。
 */

const SHORT_TERM_MAX_OWNERSHIP_YEARS = 5;

const SPECIAL_DEDUCTION_LIMIT_JPY = new Decimal(15_000_000);

// 短期譲渡所得(所有期間5年以下)の税率
const SHORT_TERM_NATIONAL_TAX_RATE = 0.3 * (1 + RECONSTRUCTION_SURTAX_RATE);
const SHORT_TERM_RESIDENT_TAX_RATE = 0.09;
// 長期譲渡所得(所有期間5年超)の税率
const LONG_TERM_NATIONAL_TAX_RATE = 0.15 * (1 + RECONSTRUCTION_SURTAX_RATE);
const LONG_TERM_RESIDENT_TAX_RATE = 0.05;

export type HoldingPeriodCategory = "SHORT_TERM" | "LONG_TERM";

export interface HousingLandDevelopmentSaleDeductionInput {
  /** 譲渡価額(買取り代金) */
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
   * 特定住宅地造成事業等のための1,500万円特別控除(措置法34条の2)の要件
   * (買取りの主体・種類、同一事業の買取りが2年以上にわたる場合は最初の年の
   * 買取りであること等。3号(民間の一団の宅地造成)は令和5年12月31日までの譲渡に
   * 限られる点も含む)を満たすか(ユーザー自身の確認事項)
   */
  specialDeductionEligible: boolean;
}

export interface HousingLandDevelopmentSaleDeductionResult {
  /** 実際に計算に採用した取得費(概算取得費を適用した場合はその金額) */
  acquisitionCostJpy: Decimal;
  /** 概算取得費(譲渡価額の5%相当額。参考表示用に常に計算する) */
  estimatedAcquisitionCostJpy: Decimal;
  /** 概算取得費の特例が実際に適用されたか */
  estimatedAcquisitionCostApplied: boolean;
  /** 特別控除適用前の譲渡所得の金額(譲渡価額-(取得費+譲渡費用)) */
  transferGainJpy: Decimal;
  holdingPeriodCategory: HoldingPeriodCategory;
  /** 実際に適用された1,500万円特別控除額(譲渡益が1,500万円未満の場合はその金額が上限) */
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

export function simulateHousingLandDevelopmentSaleDeduction(
  input: HousingLandDevelopmentSaleDeductionInput,
): HousingLandDevelopmentSaleDeductionResult {
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
    "租税特別措置法34条の2(特定住宅地造成事業等のために土地等を譲渡した場合の1,500万円特別控除。国税庁タックスアンサーNo.3223)に基づく概算値。買取りの主体・種類(措置法34条の2第2項各号)、同一事業の買取りが2以上の年にわたる場合は最初の年の買取りであること等の適用要件の判定は行わないため、必ず国税庁の解説等で自身の適用可否を確認すること。",
    "対象となる号のうち、独立行政法人都市再生機構等が行う一定規模以上の一団の宅地造成事業(措置法34条の2第2項3号)は平成6年1月1日から令和5年12月31日までの譲渡に限られる時限措置のため、令和6年(2024年)以後の譲渡にはこの号を適用できない点に注意。",
    "所有期間は譲渡した年の1月1日時点で判定する(実際の保有期間ではない点に注意)。5年以下は短期譲渡所得(税率合計39.63%)、5年超は長期譲渡所得(税率合計20.315%)。",
    "収用等の5,000万円特別控除(措置法33条の4)・居住用財産の3,000万円特別控除(措置法35条)・特定土地区画整理事業等の2,000万円特別控除(措置法34条)等、他の土地建物の特別控除と同一年に重複して適用する場合、特別控除額はその年の譲渡益全体を通じて合計5,000万円が限度となる(措法36)。この年間合計限度額の調整は行わない。",
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
    notes.push("1,500万円特別控除は未適用として試算した(specialDeductionEligible=false)。");
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
