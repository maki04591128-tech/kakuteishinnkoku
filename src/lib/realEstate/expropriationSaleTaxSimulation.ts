import { Decimal } from "decimal.js";
import { RECONSTRUCTION_SURTAX_RATE } from "../incomeTax";
import { resolveAcquisitionCostJpy } from "./estimatedAcquisitionCost";

/**
 * 収用等により土地建物を売った場合の5,000万円特別控除の試算
 * (租税特別措置法33条の4、国税庁タックスアンサーNo.3552)。
 *
 * 居住用財産(マイホーム)を譲渡した場合の税額試算(`homeSaleTaxSimulation.ts`。
 * 機能94)が「対象外とした範囲(今後の課題)」として明記していた「収用等に伴う
 * 5,000万円特別控除」に対応する。公共事業(道路・河川・都市計画事業等)の
 * ために国・地方公共団体等から土地建物の収用・買取り等を求められて譲渡した
 * 場合、実際に代替資産を取得しなくても、譲渡益から最大5,000万円を控除できる
 * 制度で、居住用財産に限らず事業用・投資用の土地建物にも適用がある点が
 * 居住用財産の3,000万円特別控除(措置法35条)と異なる。
 *
 * **主な適用要件(措置法33条の4。ユーザー自身の確認事項として`specialDeductionEligible`
 * にまとめて入力する):**
 *  - 売った土地建物が棚卸資産等ではなく固定資産であること。
 *  - その年に公共事業のために売った資産の全部について、収用等に伴い代替資産を
 *    取得した場合の課税の繰延べの特例(措置法33条・33条の2)の適用を受けて
 *    いないこと(代替資産を取得して課税を将来に繰り延べる方式との選択適用で、
 *    両方は使えない)。
 *  - 公共事業施行者から最初に買取り等の申し出を受けた日から6か月を経過した日
 *    までに土地建物を売っていること。
 *  - 公共事業施行者から最初に買取り等の申し出を受けた者
 *    (その者の死亡に伴い相続又は遺贈によりその資産を取得した者を含む)が
 *    譲渡していること。
 *
 * 居住用財産の3,000万円特別控除(措置法35条)と異なり、所有期間(短期・長期)を
 * 問わず適用でき、軽減税率の特例(措置法31条の3)のような所有期間要件も無い。
 * 短期譲渡所得・長期譲渡所得の税率区分自体は他の土地建物の譲渡所得と同じ
 * (措置法32条・31条)ため、`homeSaleTaxSimulation.ts`と同じ税率定数を用いる。
 *
 * **本ツールが試算しない範囲(今後の課題):**
 *  - 上記の適用要件(代替資産による課税繰延べの特例との選択適用、6か月以内の
 *    譲渡、最初に買取り等の申し出を受けた者本人による譲渡)の判定は行わず、
 *    `specialDeductionEligible`としてユーザー自身が確認したうえで入力する
 *    チェック項目とする(`homeSaleTaxSimulation.ts`の`specialDeductionEligible`と
 *    同様の方針)。
 *  - 代替資産を取得した場合の課税の繰延べの特例(措置法33条・33条の2。実際には
 *    譲渡していないものとみなして課税を将来に繰り延べる方式)自体は、本特例
 *    (5,000万円特別控除)とは別の選択肢のため試算しない(いずれか一方を選ぶ
 *    前提で、本モジュールは5,000万円特別控除を選んだ場合のみを対象とする)。
 *  - 居住用財産の3,000万円特別控除(措置法35条)等、他の土地建物の特別控除と
 *    同一年に重複して適用する場合の特別控除額の年間合計限度額の調整は行わない
 *    (本ツールは単一の特例の試算に特化しており、複数の特別控除の組み合わせは
 *    ユーザー自身の確認事項とする)。
 *  - 取得費が不明な場合の概算取得費(譲渡価額の5%。措置法31条の4、国税庁タックス
 *    アンサーNo.3258)は`useEstimatedAcquisitionCost`をtrueにすると、
 *    `acquisitionCostJpy`(不明な場合は0円)と5%相当額の高い方を自動採用する
 *    (`estimatedAcquisitionCost.ts`参照。`homeSaleTaxSimulation.ts`と同様の方針)。
 */

const SHORT_TERM_MAX_OWNERSHIP_YEARS = 5;

const SPECIAL_DEDUCTION_LIMIT_JPY = new Decimal(50_000_000);

// 短期譲渡所得(所有期間5年以下)の税率
const SHORT_TERM_NATIONAL_TAX_RATE = 0.3 * (1 + RECONSTRUCTION_SURTAX_RATE);
const SHORT_TERM_RESIDENT_TAX_RATE = 0.09;
// 長期譲渡所得(所有期間5年超)の税率
const LONG_TERM_NATIONAL_TAX_RATE = 0.15 * (1 + RECONSTRUCTION_SURTAX_RATE);
const LONG_TERM_RESIDENT_TAX_RATE = 0.05;

export type HoldingPeriodCategory = "SHORT_TERM" | "LONG_TERM";

export interface ExpropriationSaleTaxSimulationInput {
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
  /** 譲渡した年の1月1日時点の所有期間(年)。5年以下は短期、5年超は長期譲渡所得 */
  ownershipYears: number;
  /**
   * 収用等に伴う5,000万円特別控除(措置法33条の4)の要件(代替資産による
   * 課税繰延べの特例との選択適用、6か月以内の譲渡、最初に買取り等の申し出を
   * 受けた者本人による譲渡等)を満たすか(ユーザー自身の確認事項)
   */
  specialDeductionEligible: boolean;
}

export interface ExpropriationSaleTaxSimulationResult {
  /** 実際に計算に採用した取得費(概算取得費を適用した場合はその金額) */
  acquisitionCostJpy: Decimal;
  /** 概算取得費(譲渡価額の5%相当額。参考表示用に常に計算する) */
  estimatedAcquisitionCostJpy: Decimal;
  /** 概算取得費の特例が実際に適用されたか */
  estimatedAcquisitionCostApplied: boolean;
  /** 特別控除適用前の譲渡所得の金額(譲渡価額-(取得費+譲渡費用)) */
  transferGainJpy: Decimal;
  holdingPeriodCategory: HoldingPeriodCategory;
  /** 実際に適用された5,000万円特別控除額(譲渡益が5,000万円未満の場合はその金額が上限) */
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

export function simulateExpropriationSaleTax(
  input: ExpropriationSaleTaxSimulationInput,
): ExpropriationSaleTaxSimulationResult {
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
    "租税特別措置法33条の4(収用等に伴い代替資産を取得しない場合の5,000万円特別控除。国税庁タックスアンサーNo.3552)に基づく概算値。代替資産による課税繰延べの特例(措置法33条・33条の2)との選択適用、公共事業施行者から最初に買取り等の申し出を受けた日から6か月以内の譲渡であること、その申し出を受けた者本人(相続人を含む)による譲渡であること等の適用要件の判定は行わないため、必ず国税庁タックスアンサーNo.3552等で自身の適用可否を確認すること。",
    "所有期間は譲渡した年の1月1日時点で判定する(実際の保有期間ではない点に注意)。5年以下は短期譲渡所得(税率合計39.63%)、5年超は長期譲渡所得(税率合計20.315%)。居住用財産の軽減税率の特例(措置法31条の3)のような所有期間要件は本特例には無い。",
    "居住用財産の3,000万円特別控除(措置法35条)等、他の土地建物の特別控除と同一年に重複して適用する場合の年間合計限度額の調整は行わない。",
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
    notes.push("5,000万円特別控除は未適用として試算した(specialDeductionEligible=false)。");
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
