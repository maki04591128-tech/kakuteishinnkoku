import { Decimal } from "decimal.js";
import { RECONSTRUCTION_SURTAX_RATE } from "../incomeTax";
import { resolveAcquisitionCostJpy } from "./estimatedAcquisitionCost";

/**
 * 特定土地区画整理事業等のために土地等を売った場合の2,000万円特別控除の試算
 * (租税特別措置法34条、国税庁タックスアンサーNo.3223「譲渡所得の特別控除の種類」・
 * 確定申告書等作成コーナー「措置法34条」)。
 *
 * 収用等により土地建物を売った場合の5,000万円特別控除(`expropriationSaleTaxSimulation.ts`。
 * 機能113)と同じ「公共事業等のために土地等を売った場合の特別控除」の系統だが、対象と
 * なる事業の種類(公共事業一般ではなく、土地区画整理事業・住宅街区整備事業・第一種
 * 市街地再開発事業・防災街区整備事業等、都市計画・文化財保護・自然環境保全等の
 * 特定の事業に限定される)・控除額(2,000万円)が異なる。国税庁タックスアンサー
 * No.3223によれば、土地建物の譲渡所得の特別控除は控除額の大きい順に
 * (1)収用等5,000万円→(2)居住用財産3,000万円→(3)本特例(特定土地区画整理事業等)
 * 2,000万円→(4)特定住宅地造成事業等1,500万円→(5)平成21・22年取得分1,000万円→
 * (6)農地保有の合理化等800万円→(7)低未利用土地等100万円、の順に適用し、その年の
 * 譲渡益全体を通じて合計5,000万円が限度となる(措法36。本ツールは単一の特例の
 * 試算に特化しており、この年間合計限度額の調整はユーザー自身の確認事項とする)。
 *
 * **主な適用要件(措置法34条1項各号。ユーザー自身の確認事項として`specialDeductionEligible`
 * にまとめて入力する。確定申告書等作成コーナー「措置法34条」を一次情報として要約):**
 *  - 国・地方公共団体・独立行政法人都市再生機構・地方住宅供給公社等が、土地区画整理
 *    事業・住宅街区整備事業・第一種市街地再開発事業・防災街区整備事業として行う
 *    公共施設の整備改善や宅地の造成等のために土地等が買い取られた場合。
 *  - 都市計画法56条1項の事業予定地内の土地等が、第一種市街地再開発組合・防災街区
 *    整備事業組合(事業計画決定前に設立されたもの)に買い取られた場合。
 *  - 古都保存法・都市緑地法・特定空港周辺航空機騒音対策特別措置法等に基づき土地等が
 *    買い取られた場合。
 *  - 文化財保護法の重要文化財・史跡名勝天然記念物、自然公園法の特別地域、自然環境
 *    保全法の特別地区内の土地が国・地方公共団体等に買い取られた場合。
 *  - 保安林の区域内の土地が保安施設事業のため買い取られた場合。
 *  - 防災集団移転促進事業計画の移転促進区域内の農地等が買い取られた場合。
 *  - 農業経営基盤強化促進法の農用地利用改善事業の実施区域内の農用地が、農地中間
 *    管理機構に買い取られた場合。
 *  - 同一の事業のための買取りが2以上の年にわたる場合、本特別控除は最初の年の
 *    買取りにのみ適用され、2年目以降の買取りには適用されない(措法34条3項)。
 *
 * 収用等の5,000万円特別控除(措置法33条の4)と同様、所有期間(短期・長期)を問わず
 * 適用でき、短期・長期譲渡所得の税率区分自体は他の土地建物の譲渡所得と同じ
 * (措置法32条・31条)ため、`expropriationSaleTaxSimulation.ts`と同じ税率定数を用いる。
 *
 * **本ツールが試算しない範囲(今後の課題):**
 *  - 上記の適用要件(事業主体・買取りの種類、同一事業の買取りが2年以上にわたる場合の
 *    「最初の年」判定)の判定は行わず、`specialDeductionEligible`としてユーザー自身が
 *    確認したうえで入力するチェック項目とする(`expropriationSaleTaxSimulation.ts`の
 *    `specialDeductionEligible`と同様の方針)。
 *  - 他の土地建物の特別控除(収用等5,000万円・居住用財産3,000万円等)と同一年に
 *    重複して適用する場合の年間合計5,000万円限度額(措法36)の調整は行わない
 *    (本ツールは単一の特例の試算に特化しており、複数の特別控除の組み合わせは
 *    ユーザー自身の確認事項とする)。
 *  - 取得費が不明な場合の概算取得費(譲渡価額の5%。措置法31条の4、国税庁タックス
 *    アンサーNo.3258)は`useEstimatedAcquisitionCost`をtrueにすると、
 *    `acquisitionCostJpy`(不明な場合は0円)と5%相当額の高い方を自動採用する
 *    (`estimatedAcquisitionCost.ts`参照。`expropriationSaleTaxSimulation.ts`と同様の方針)。
 */

const SHORT_TERM_MAX_OWNERSHIP_YEARS = 5;

const SPECIAL_DEDUCTION_LIMIT_JPY = new Decimal(20_000_000);

// 短期譲渡所得(所有期間5年以下)の税率
const SHORT_TERM_NATIONAL_TAX_RATE = 0.3 * (1 + RECONSTRUCTION_SURTAX_RATE);
const SHORT_TERM_RESIDENT_TAX_RATE = 0.09;
// 長期譲渡所得(所有期間5年超)の税率
const LONG_TERM_NATIONAL_TAX_RATE = 0.15 * (1 + RECONSTRUCTION_SURTAX_RATE);
const LONG_TERM_RESIDENT_TAX_RATE = 0.05;

export type HoldingPeriodCategory = "SHORT_TERM" | "LONG_TERM";

export interface LandReadjustmentSaleDeductionInput {
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
   * 特定土地区画整理事業等のための2,000万円特別控除(措置法34条)の要件
   * (事業主体・買取りの種類、同一事業の買取りが2年以上にわたる場合は最初の年の
   * 買取りであること等)を満たすか(ユーザー自身の確認事項)
   */
  specialDeductionEligible: boolean;
}

export interface LandReadjustmentSaleDeductionResult {
  /** 実際に計算に採用した取得費(概算取得費を適用した場合はその金額) */
  acquisitionCostJpy: Decimal;
  /** 概算取得費(譲渡価額の5%相当額。参考表示用に常に計算する) */
  estimatedAcquisitionCostJpy: Decimal;
  /** 概算取得費の特例が実際に適用されたか */
  estimatedAcquisitionCostApplied: boolean;
  /** 特別控除適用前の譲渡所得の金額(譲渡価額-(取得費+譲渡費用)) */
  transferGainJpy: Decimal;
  holdingPeriodCategory: HoldingPeriodCategory;
  /** 実際に適用された2,000万円特別控除額(譲渡益が2,000万円未満の場合はその金額が上限) */
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

export function simulateLandReadjustmentSaleDeduction(
  input: LandReadjustmentSaleDeductionInput,
): LandReadjustmentSaleDeductionResult {
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
    "租税特別措置法34条(特定土地区画整理事業等のために土地等を譲渡した場合の2,000万円特別控除。国税庁タックスアンサーNo.3223、確定申告書等作成コーナー「措置法34条」)に基づく概算値。事業主体・買取りの種類(土地区画整理事業・市街地再開発事業・文化財保護法等)、同一事業の買取りが2以上の年にわたる場合は最初の年の買取りであること等の適用要件の判定は行わないため、必ず国税庁の解説等で自身の適用可否を確認すること。",
    "所有期間は譲渡した年の1月1日時点で判定する(実際の保有期間ではない点に注意)。5年以下は短期譲渡所得(税率合計39.63%)、5年超は長期譲渡所得(税率合計20.315%)。",
    "収用等の5,000万円特別控除(措置法33条の4)・居住用財産の3,000万円特別控除(措置法35条)等、他の土地建物の特別控除と同一年に重複して適用する場合、特別控除額はその年の譲渡益全体を通じて合計5,000万円が限度となる(措法36)。この年間合計限度額の調整は行わない。",
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
    notes.push("2,000万円特別控除は未適用として試算した(specialDeductionEligible=false)。");
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
