import { Decimal } from "decimal.js";
import { RECONSTRUCTION_SURTAX_RATE } from "../incomeTax";
import { resolveAcquisitionCostJpy } from "./estimatedAcquisitionCost";

/**
 * 収用等に伴い代替資産を取得した場合の課税の繰延べの特例の試算
 * (租税特別措置法33条・33条の2、国税庁タックスアンサーNo.3552)。
 *
 * 収用等により土地建物を売った場合の5,000万円特別控除の試算(`expropriationSaleTaxSimulation.ts`。
 * 機能113)が「対象外とした範囲(今後の課題)」として明記していた、代替資産を
 * 取得した場合の課税の繰延べの特例(措置法33条・33条の2)に対応する。5,000万円
 * 特別控除(措置法33条の4)とは選択適用の関係にあり、実際に代替資産を取得して
 * いる場合に、譲渡が無かったものとみなして課税を将来に繰り延べる(または一部の
 * みを繰り延べる)方式を選ぶことができる。
 *
 * **計算方法(国税庁タックスアンサーNo.3552):**
 * 代替資産の取得価額が譲渡価額以上(譲渡代金の全部で代替資産を取得した場合)は、
 * 譲渡が無かったものとみなされ、その年の税額は生じない(全額繰延べ)。代替資産の
 * 取得価額が譲渡価額を下回る場合(譲渡代金の一部で代替資産を取得した場合)は、
 * 充当されなかった差額(差金額 = 譲渡価額-代替資産の取得価額)に対応する部分
 * についてのみ課税される。課税される譲渡所得の金額は次の式で計算する。
 *
 *   課税譲渡所得金額 = 譲渡益の総額 ×(差金額 ÷ 譲渡価額)
 *
 * (譲渡益の総額 = 譲渡価額-(取得費+譲渡費用)。差金額に対応する取得費・
 * 譲渡費用の割合分だけを差し引いた金額と同じ結果になる)。短期・長期の税率
 * 区分自体は他の土地建物の譲渡所得と同じ(措置法31条・32条)のため、
 * `expropriationSaleTaxSimulation.ts`と同じ税率定数を再利用する。取得費が
 * 不明な場合の概算取得費の特例(措置法31条の4、機能102の
 * `estimatedAcquisitionCost.ts`)もそのまま適用できる汎用モジュールのため
 * 再利用した。
 *
 * 代替資産を将来譲渡する際に引き継がれる取得価額(いわゆる圧縮記帳後の帳簿
 * 価額)は次の式で計算し、参考値として結果に含める。
 *
 *   引継ぎ取得価額 = 代替資産の実際の取得価額-繰り延べられた譲渡益
 *   (繰り延べられた譲渡益 = 譲渡益の総額-課税譲渡所得金額)
 *
 * **対象外とした範囲(今後の課題):**
 *  - 適用要件(代替資産を原則として譲渡の日の前年1月1日から翌々年12月31日
 *    まで(税務署長の承認により延長可)の間に取得すること、代替資産が措置法
 *    33条1項各号に定める資産区分(譲渡資産と同種の資産か、事業用資産の範囲
 *    要件を満たすか等)に該当すること)の判定は行わず、`expropriationSaleTaxSimulation.ts`の
 *    `specialDeductionEligible`と同様に`deferralEligible`としてユーザー自身が
 *    確認したうえで入力するチェック項目とする。
 *  - 5,000万円特別控除(措置法33条の4。機能113)とは選択適用の関係にあるため、
 *    本モジュールは課税繰延べの特例を選んだ場合のみを対象とする(両方を同時に
 *    適用することはできない)。
 *  - 代替資産を将来譲渡した際に引き継がれる取得価額は参考値として計算するが、
 *    本ツールは単体の試算画面(DBへの登録機能を持たない)であるため、翌年以降の
 *    保有銘柄・取得費への自動反映は行わない(ユーザー自身が将来の譲渡時に
 *    手入力する前提)。
 *  - 事業用資産の買換えの特例(措置法37条等)等、収用等とは別の買換え特例は
 *    対象外。
 *  - 取得費が不明な場合の概算取得費(譲渡価額の5%相当額。措置法31条の4、
 *    国税庁タックスアンサーNo.3258)は`useEstimatedAcquisitionCost`をtrueに
 *    すると、`acquisitionCostJpy`(不明な場合は0円)と5%相当額の高い方を
 *    自動採用する(`estimatedAcquisitionCost.ts`参照)。
 */

const SHORT_TERM_MAX_OWNERSHIP_YEARS = 5;

// 短期譲渡所得(所有期間5年以下)の税率
const SHORT_TERM_NATIONAL_TAX_RATE = 0.3 * (1 + RECONSTRUCTION_SURTAX_RATE);
const SHORT_TERM_RESIDENT_TAX_RATE = 0.09;
// 長期譲渡所得(所有期間5年超)の税率
const LONG_TERM_NATIONAL_TAX_RATE = 0.15 * (1 + RECONSTRUCTION_SURTAX_RATE);
const LONG_TERM_RESIDENT_TAX_RATE = 0.05;

export type HoldingPeriodCategory = "SHORT_TERM" | "LONG_TERM";

export interface ExpropriationReplacementDeferralInput {
  /** 譲渡価額(補償金・買取り代金) */
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
  /** 実際に取得した代替資産の取得価額(取得していない場合は0円) */
  replacementAssetAcquisitionCostJpy: Decimal.Value;
  /** 譲渡した年の1月1日時点の所有期間(年)。5年以下は短期、5年超は長期譲渡所得 */
  ownershipYears: number;
  /**
   * 課税繰延べの特例(措置法33条・33条の2)の要件(代替資産の取得期限内の
   * 取得、代替資産の資産区分要件等)を満たすか(ユーザー自身の確認事項)
   */
  deferralEligible: boolean;
}

export interface ExpropriationReplacementDeferralResult {
  /** 実際に計算に採用した取得費(概算取得費を適用した場合はその金額) */
  acquisitionCostJpy: Decimal;
  /** 概算取得費(譲渡価額の5%相当額。参考表示用に常に計算する) */
  estimatedAcquisitionCostJpy: Decimal;
  /** 概算取得費の特例が実際に適用されたか */
  estimatedAcquisitionCostApplied: boolean;
  /** 特例適用前の譲渡所得の金額(譲渡価額-(取得費+譲渡費用)) */
  transferGainJpy: Decimal;
  holdingPeriodCategory: HoldingPeriodCategory;
  /** 代替資産の取得価額に充当されなかった差金額(課税対象の収入金額に相当) */
  taxableProceedsJpy: Decimal;
  /** 課税繰延べにより繰り延べられた譲渡益 */
  deferredGainJpy: Decimal;
  /** 課税繰延べ後の課税譲渡所得金額 */
  taxableGainJpy: Decimal;
  /** 代替資産を将来譲渡する際に引き継がれる取得価額(圧縮記帳後の帳簿価額) */
  replacementAssetCarryoverCostJpy: Decimal;
  /** 代替資産の取得価額が譲渡価額以上で、譲渡益の全額が繰り延べられたか */
  fullyDeferred: boolean;
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

export function simulateExpropriationReplacementDeferral(
  input: ExpropriationReplacementDeferralInput,
): ExpropriationReplacementDeferralResult {
  const transferPriceJpy = new Decimal(input.transferPriceJpy);
  const transferExpensesJpy = new Decimal(input.transferExpensesJpy);
  const replacementAssetAcquisitionCostJpy = new Decimal(input.replacementAssetAcquisitionCostJpy);

  requireNonNegative(transferPriceJpy, "譲渡価額");
  requireNonNegative(transferExpensesJpy, "譲渡費用");
  requireNonNegative(replacementAssetAcquisitionCostJpy, "代替資産の取得価額");
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
    "租税特別措置法33条・33条の2(収用等に伴い代替資産を取得した場合の課税の繰延べの特例。国税庁タックスアンサーNo.3552)に基づく概算値。代替資産の取得期限(原則として譲渡の日の前年1月1日から翌々年12月31日まで)・資産区分要件(措置法33条1項各号)等の適用要件の判定は行わないため、必ず国税庁タックスアンサーNo.3552等で自身の適用可否を確認すること。5,000万円特別控除(措置法33条の4)とは選択適用の関係にあり、本モジュールは課税繰延べの特例を選んだ場合のみを対象とする。",
    "所有期間は譲渡した年の1月1日時点で判定する(実際の保有期間ではない点に注意)。5年以下は短期譲渡所得(税率合計39.63%)、5年超は長期譲渡所得(税率合計20.315%)。",
    "代替資産を将来譲渡する際に引き継がれる取得価額(圧縮記帳後の帳簿価額)は参考値として算出するが、本ツールは単体の試算画面のためDBへの登録・翌年以降への自動繰越は行わない。",
    ...acquisitionCostResolution.notes,
  ];

  if (transferGainJpy.lessThanOrEqualTo(0)) {
    notes.push("譲渡損失(譲渡価額が取得費・譲渡費用の合計以下)のため税額は生じない(課税繰延べの特例を適用する必要も無い)。");
    return {
      acquisitionCostJpy,
      estimatedAcquisitionCostJpy: acquisitionCostResolution.estimatedAcquisitionCostJpy,
      estimatedAcquisitionCostApplied: acquisitionCostResolution.estimatedApplied,
      transferGainJpy,
      holdingPeriodCategory,
      taxableProceedsJpy: new Decimal(0),
      deferredGainJpy: new Decimal(0),
      taxableGainJpy: new Decimal(0),
      replacementAssetCarryoverCostJpy: replacementAssetAcquisitionCostJpy,
      fullyDeferred: false,
      nationalTaxJpy: new Decimal(0),
      residentTaxJpy: new Decimal(0),
      totalTaxJpy: new Decimal(0),
      notes,
    };
  }

  const effectiveReplacementCostJpy = input.deferralEligible
    ? replacementAssetAcquisitionCostJpy
    : new Decimal(0);
  if (!input.deferralEligible) {
    notes.push("課税繰延べの特例の要件を満たさないとして、繰延べ未適用(代替資産を取得しなかった場合と同じ)で試算した(deferralEligible=false)。");
  } else if (replacementAssetAcquisitionCostJpy.greaterThan(transferPriceJpy)) {
    notes.push(
      `代替資産の取得価額(${replacementAssetAcquisitionCostJpy.toFixed(0)}円)が譲渡価額(${transferPriceJpy.toFixed(0)}円)を超えるため、譲渡価額を上限として繰延べに充当した(超過分は本特例と無関係)。`,
    );
  }

  const replacementAssetAppliedJpy = Decimal.min(effectiveReplacementCostJpy, transferPriceJpy);
  const taxableProceedsJpy = transferPriceJpy.minus(replacementAssetAppliedJpy);
  const fullyDeferred = input.deferralEligible && taxableProceedsJpy.isZero();

  const taxableGainJpy = fullyDeferred
    ? new Decimal(0)
    : transferGainJpy.times(taxableProceedsJpy).dividedBy(transferPriceJpy);
  const deferredGainJpy = transferGainJpy.minus(taxableGainJpy);
  const replacementAssetCarryoverCostJpy = replacementAssetAcquisitionCostJpy.minus(
    input.deferralEligible ? deferredGainJpy : new Decimal(0),
  );

  if (fullyDeferred) {
    notes.push("代替資産の取得価額が譲渡価額以上のため、譲渡が無かったものとみなされ課税は全額繰り延べられる(当年の税額は0円)。");
  } else if (input.deferralEligible) {
    notes.push(
      `代替資産の取得価額に充当されなかった差金額(${taxableProceedsJpy.toFixed(0)}円)に対応する部分についてのみ課税される(譲渡益の総額×差金額÷譲渡価額)。`,
    );
  }

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
    taxableProceedsJpy,
    deferredGainJpy,
    taxableGainJpy,
    replacementAssetCarryoverCostJpy,
    fullyDeferred,
    nationalTaxJpy,
    residentTaxJpy,
    totalTaxJpy: nationalTaxJpy.plus(residentTaxJpy),
    notes,
  };
}
