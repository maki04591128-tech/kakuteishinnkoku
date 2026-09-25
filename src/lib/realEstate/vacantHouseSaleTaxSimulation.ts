import { Decimal } from "decimal.js";
import { RECONSTRUCTION_SURTAX_RATE } from "../incomeTax";

/**
 * 被相続人の居住用財産(空き家)を譲渡した場合の3,000万円特別控除の試算
 * (租税特別措置法35条3項、国税庁タックスアンサーNo.3306)。
 *
 * 居住用財産(マイホーム)の3,000万円特別控除(措置法35条1項。`homeSaleTaxSimulation.ts`)は
 * 「自己の居住用財産」が対象だが、本特例は相続又は遺贈により取得した被相続人の
 * 空き家(及びその敷地)を相続人が譲渡した場合が対象で、要件・控除限度額の
 * 判定基準が異なる別制度のため独立したモジュールとして実装する。
 *
 * **主な適用要件(措置法35条3項。ユーザー自身の確認事項):**
 *  - 家屋が昭和56年5月31日以前に建築されたものであること(区分所有建築物を除く)。
 *  - 相続の開始の直前において被相続人が一人で居住していたこと(要介護認定を
 *    受けて老人ホーム等に入所していた場合の特例は本ツールでは考慮しない)。
 *  - 相続の開始があった時から譲渡の時まで、事業の用・貸付けの用・居住の用に
 *    供されていたことがないこと。
 *  - 譲渡の時からその譲渡の日の属する年の翌年2月15日までに、耐震基準に適合する
 *    こととなったか、家屋の全部の取壊し等を行ったこと。
 *  - 譲渡先が配偶者・直系血族等の特別の関係がある者でないこと。
 *  - 相続の開始があった日から3年を経過する日の属する年の12月31日までの譲渡で
 *    あること、かつ平成28年4月1日から令和9年12月31日までの譲渡であること。
 *
 * 上記のうち譲渡対価の額(1億円以下であること)のみは入力値から自動判定できるため
 * `eligible`の判定に組み込む。その他の要件は住所・介護認定等の外部情報が必要で
 * 本ツールでは検証できないため、`eligibilityConfirmed`・
 * `demolishedOrEarthquakeResistant`としてユーザー自身が確認したうえで入力する
 * チェック項目とする(`homeSaleTaxSimulation.ts`の`specialDeductionEligible`と
 * 同様の方針)。
 *
 * 相続又は遺贈によりこの家屋及び敷地等を取得した相続人の数が3人以上の場合、
 * 令和6年1月1日以後の譲渡については控除限度額が3,000万円ではなく2,000万円に
 * 引き下げられる(令和5年度税制改正)。本ツールは現行(令和6年1月1日以後)の
 * 譲渡のみを前提とし、それより前の譲渡(3人以上でも一律3,000万円)は対象外とする。
 *
 * 取得費・取得時期は相続により被相続人からそのまま引き継ぐ(所得税法60条1項)。
 * 家屋の建築時期の要件(昭和56年5月31日以前)により、相続開始からの所有期間が
 * 短くても実際の所有期間(引き継いだ取得時期を基準とする)は必ず5年を超えるため、
 * 本モジュールは短期譲渡所得の税率区分を持たず、常に長期譲渡所得の税率
 * (所得税・復興特別所得税15.315%+住民税5%=20.315%)で計算する。
 *
 * **本ツールが試算しない範囲(今後の課題):**
 *  - 所有期間10年超の居住用財産の軽減税率の特例(措置法31条の3)は、相続人自身が
 *    居住していない空き家には通常適用がないため対象外(`homeSaleTaxSimulation.ts`
 *    参照)。
 *  - 同一年に居住用財産の3,000万円特別控除(措置法35条1項)や収用等に伴う
 *    5,000万円特別控除等、他の譲渡所得の特別控除との重複適用の可否判定は行わない。
 *  - 取得費が不明な場合の概算取得費(譲渡価額の5%。措置法31条の4)は自動算出しない。
 */

export interface VacantHouseSaleTaxSimulationInput {
  /** 譲渡価額(売却代金) */
  transferPriceJpy: Decimal.Value;
  /** 取得費(被相続人の取得費をそのまま引き継ぐ。所得税法60条1項) */
  acquisitionCostJpy: Decimal.Value;
  /** 譲渡費用(仲介手数料・印紙税・家屋の取壊し費用等) */
  transferExpensesJpy: Decimal.Value;
  /** 相続又は遺贈によりこの家屋及び敷地等を取得した相続人の数(1以上の整数) */
  heirCount: number;
  /**
   * 家屋の建築時期・被相続人の居住実績・相続開始後の用途・譲渡先等、
   * 措置法35条3項の要件(譲渡対価1億円以下を除く)を満たすか(ユーザー自身の確認事項)
   */
  eligibilityConfirmed: boolean;
  /**
   * 譲渡の時からその譲渡の日の属する年の翌年2月15日までに、耐震基準に適合する
   * こととなったか、家屋の全部の取壊し等を行ったか(ユーザー自身の確認事項)
   */
  demolishedOrEarthquakeResistant: boolean;
}

export interface VacantHouseSaleTaxSimulationResult {
  /** 特別控除適用前の譲渡所得の金額(譲渡価額-(取得費+譲渡費用)) */
  transferGainJpy: Decimal;
  /** 相続人の数に応じた控除限度額(3人未満: 3,000万円、3人以上: 2,000万円) */
  specialDeductionLimitJpy: Decimal;
  /** 実際に適用された特別控除額 */
  specialDeductionAppliedJpy: Decimal;
  /** 特別控除後の課税譲渡所得金額 */
  taxableGainJpy: Decimal;
  /** 特例の適用要件(譲渡対価1億円以下を含む)を満たすと判定したか */
  eligible: boolean;
  /** 譲渡対価が1億円を超えているため特例の対象外か(自動判定) */
  transferPriceExceedsLimit: boolean;
  nationalTaxJpy: Decimal;
  residentTaxJpy: Decimal;
  totalTaxJpy: Decimal;
  notes: string[];
}

// 譲渡対価の上限(これを超えると特例の対象外)
const TRANSFER_PRICE_LIMIT_JPY = new Decimal(100_000_000);
// 特別控除限度額(相続人が3人未満の場合)
const SPECIAL_DEDUCTION_LIMIT_JPY = new Decimal(30_000_000);
// 特別控除限度額(相続人が3人以上・令和6年1月1日以後の譲渡の場合)
const SPECIAL_DEDUCTION_LIMIT_JPY_THREE_OR_MORE_HEIRS = new Decimal(20_000_000);
const THREE_OR_MORE_HEIRS_THRESHOLD = 3;

// 長期譲渡所得の税率(本特例は常に長期譲渡所得。モジュール冒頭のコメント参照)
const LONG_TERM_NATIONAL_TAX_RATE = 0.15 * (1 + RECONSTRUCTION_SURTAX_RATE);
const LONG_TERM_RESIDENT_TAX_RATE = 0.05;

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function simulateVacantHouseSaleTax(
  input: VacantHouseSaleTaxSimulationInput,
): VacantHouseSaleTaxSimulationResult {
  const transferPriceJpy = new Decimal(input.transferPriceJpy);
  const acquisitionCostJpy = new Decimal(input.acquisitionCostJpy);
  const transferExpensesJpy = new Decimal(input.transferExpensesJpy);

  requireNonNegative(transferPriceJpy, "譲渡価額");
  requireNonNegative(acquisitionCostJpy, "取得費");
  requireNonNegative(transferExpensesJpy, "譲渡費用");
  if (!Number.isInteger(input.heirCount) || input.heirCount < 1) {
    throw new Error("相続人の数は1以上の整数である必要があります");
  }

  const transferGainJpy = transferPriceJpy.minus(acquisitionCostJpy).minus(transferExpensesJpy);

  const notes: string[] = [
    "租税特別措置法35条3項(被相続人の居住用財産(空き家)を売ったときの特例。国税庁タックスアンサーNo.3306)に基づく概算値。",
    "取得費・取得時期は相続により被相続人からそのまま引き継ぐため(所得税法60条1項)、家屋が昭和56年5月31日以前に建築されたものである本特例の対象では、所有期間は必ず5年を超える。そのため常に長期譲渡所得の税率(20.315%)で計算する。",
    "平成28年4月1日から令和9年12月31日までの譲渡が対象(それ以外の譲渡日は本ツールでは考慮しない)。",
  ];

  if (transferGainJpy.lessThanOrEqualTo(0)) {
    notes.push(
      "譲渡損失(譲渡価額が取得費・譲渡費用の合計以下)のため税額は生じない。",
    );
    return {
      transferGainJpy,
      specialDeductionLimitJpy: new Decimal(0),
      specialDeductionAppliedJpy: new Decimal(0),
      taxableGainJpy: new Decimal(0),
      eligible: false,
      transferPriceExceedsLimit: false,
      nationalTaxJpy: new Decimal(0),
      residentTaxJpy: new Decimal(0),
      totalTaxJpy: new Decimal(0),
      notes,
    };
  }

  const transferPriceExceedsLimit = transferPriceJpy.greaterThan(TRANSFER_PRICE_LIMIT_JPY);
  if (transferPriceExceedsLimit) {
    notes.push(
      `譲渡対価の額(${transferPriceJpy.toString()}円)が上限の1億円を超えているため、本特例の対象外(自動判定)。`,
    );
  }

  const eligible =
    input.eligibilityConfirmed && input.demolishedOrEarthquakeResistant && !transferPriceExceedsLimit;

  if (!input.eligibilityConfirmed) {
    notes.push(
      "家屋の建築時期・被相続人の居住実績・相続開始後の用途・譲渡先等の要件(eligibilityConfirmed)を満たさないため未適用として試算した。",
    );
  }
  if (!input.demolishedOrEarthquakeResistant) {
    notes.push(
      "譲渡の日の属する年の翌年2月15日までの耐震基準適合または家屋の取壊しの要件(demolishedOrEarthquakeResistant)を満たさないため未適用として試算した。",
    );
  }

  const isThreeOrMoreHeirs = input.heirCount >= THREE_OR_MORE_HEIRS_THRESHOLD;
  const specialDeductionLimitJpy = isThreeOrMoreHeirs
    ? SPECIAL_DEDUCTION_LIMIT_JPY_THREE_OR_MORE_HEIRS
    : SPECIAL_DEDUCTION_LIMIT_JPY;
  if (isThreeOrMoreHeirs) {
    notes.push(
      `相続人の数が${input.heirCount}人(3人以上)のため、控除限度額は3,000万円ではなく2,000万円(令和6年1月1日以後の譲渡)。`,
    );
  }

  const specialDeductionAppliedJpy = eligible
    ? Decimal.min(transferGainJpy, specialDeductionLimitJpy)
    : new Decimal(0);

  const taxableGainJpy = transferGainJpy.minus(specialDeductionAppliedJpy);
  const nationalTaxJpy = taxableGainJpy.times(LONG_TERM_NATIONAL_TAX_RATE);
  const residentTaxJpy = taxableGainJpy.times(LONG_TERM_RESIDENT_TAX_RATE);

  return {
    transferGainJpy,
    specialDeductionLimitJpy,
    specialDeductionAppliedJpy,
    taxableGainJpy,
    eligible,
    transferPriceExceedsLimit,
    nationalTaxJpy,
    residentTaxJpy,
    totalTaxJpy: nationalTaxJpy.plus(residentTaxJpy),
    notes,
  };
}
