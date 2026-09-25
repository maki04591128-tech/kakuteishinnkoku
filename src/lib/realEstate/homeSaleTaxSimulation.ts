import { Decimal } from "decimal.js";
import { RECONSTRUCTION_SURTAX_RATE } from "../incomeTax";

/**
 * 居住用財産(マイホーム)を譲渡した場合の税額試算。
 *
 * 土地・建物等の譲渡所得は、上場株式等の譲渡所得(src/lib/investment/calculator.ts)や
 * 暗号資産の雑所得(src/lib/crypto/calculator.ts)とは全く別区分の申告分離課税であり、
 * これまで本ツールのスコープ外としてきた(src/lib/investment/
 * inheritedAcquisitionCostAddition.ts の制約欄参照)。本モジュールはそのうち最も
 * 利用頻度が高い「居住用財産(マイホーム)の譲渡」に絞り、次の2つの特例を試算する。
 *
 *  - 居住用財産を譲渡した場合の3,000万円特別控除(租税特別措置法35条、国税庁
 *    タックスアンサーNo.3302): 所有期間を問わず、譲渡益から最大3,000万円を控除できる。
 *  - 特定の居住用財産を譲渡した場合の軽減税率の特例(租税特別措置法31条の3、国税庁
 *    タックスアンサーNo.3305): 譲渡した年の1月1日時点で所有期間が10年を超える居住用
 *    財産について、3,000万円特別控除後の譲渡所得のうち6,000万円以下の部分に軽減税率
 *    (所得税10%+復興特別所得税・住民税4%)を適用する(6,000万円超の部分は通常の
 *    長期譲渡所得の税率)。3,000万円特別控除と併用できる。
 *
 * **本ツールが試算しない範囲(今後の課題):**
 *  - 3,000万円特別控除・軽減税率の特例それぞれの適用要件(自己の居住用財産であること、
 *    配偶者・直系血族等特別の関係がある者への譲渡でないこと、前年・前々年に同一の特例の
 *    適用を受けていないこと等)の判定は行わず、`specialDeductionEligible`・
 *    `reducedRateEligible`としてユーザー自身が確認したうえで入力するチェック項目とする。
 *  - 譲渡損失が生じた場合の「居住用財産の買換え等の場合の譲渡損失の損益通算及び
 *    繰越控除」「特定居住用財産の譲渡損失の損益通算及び繰越控除」(措置法41条の5・
 *    41条の5の2)は、買換資産の借入金等の別データが必要なため対象外。譲渡損失が
 *    生じた場合はその旨のみ注記し、税額は0円として返す。
 *  - 取得費が不明な場合の概算取得費(譲渡価額の5%。措置法31条の4)は自動算出せず、
 *    `acquisitionCostJpy`にユーザー自身が算出した金額(概算取得費を用いる場合はその額)を
 *    入力する前提とする。
 *  - 収用等に伴う5,000万円特別控除・被相続人の居住用財産(空き家)を譲渡した場合の
 *    3,000万円特別控除(措置法35条3項)等、他の譲渡所得の特例は対象外。
 *  - 住宅ローン控除(`mortgageDeduction.ts`)との重複適用制限(買換え等の場合、
 *    譲渡した年から3年間は新居の住宅ローン控除と併用不可)の判定は行わない。
 */

const SHORT_TERM_MAX_OWNERSHIP_YEARS = 5;
const REDUCED_RATE_MIN_OWNERSHIP_YEARS = 10;

const SPECIAL_DEDUCTION_LIMIT_JPY = new Decimal(30_000_000);
const REDUCED_RATE_PORTION_LIMIT_JPY = new Decimal(60_000_000);

// 短期譲渡所得(所有期間5年以下)の税率
const SHORT_TERM_NATIONAL_TAX_RATE = 0.3 * (1 + RECONSTRUCTION_SURTAX_RATE);
const SHORT_TERM_RESIDENT_TAX_RATE = 0.09;
// 長期譲渡所得(所有期間5年超)の税率
const LONG_TERM_NATIONAL_TAX_RATE = 0.15 * (1 + RECONSTRUCTION_SURTAX_RATE);
const LONG_TERM_RESIDENT_TAX_RATE = 0.05;
// 軽減税率の特例(所有期間10年超・6,000万円以下の部分)の税率
const REDUCED_NATIONAL_TAX_RATE = 0.1 * (1 + RECONSTRUCTION_SURTAX_RATE);
const REDUCED_RESIDENT_TAX_RATE = 0.04;

export type HoldingPeriodCategory = "SHORT_TERM" | "LONG_TERM";

export interface HomeSaleTaxSimulationInput {
  /** 譲渡価額(売却代金) */
  transferPriceJpy: Decimal.Value;
  /** 取得費(取得価額-減価償却費相当額等) */
  acquisitionCostJpy: Decimal.Value;
  /** 譲渡費用(仲介手数料・印紙税等) */
  transferExpensesJpy: Decimal.Value;
  /** 譲渡した年の1月1日時点の所有期間(年)。5年以下は短期、5年超は長期譲渡所得 */
  ownershipYears: number;
  /** 居住用財産の3,000万円特別控除(措置法35条)の要件を満たすか(ユーザー自身の確認事項) */
  specialDeductionEligible: boolean;
  /**
   * 所有期間10年超の居住用財産の軽減税率の特例(措置法31条の3)の要件を満たすか
   * (ユーザー自身の確認事項)。所有期間が10年以下の場合はこの特例自体が対象外
   */
  reducedRateEligible: boolean;
}

export interface HomeSaleTaxRatePortion {
  label: string;
  taxableGainJpy: Decimal;
  nationalTaxJpy: Decimal;
  residentTaxJpy: Decimal;
}

export interface HomeSaleTaxSimulationResult {
  /** 特別控除適用前の譲渡所得の金額(譲渡価額-(取得費+譲渡費用)) */
  transferGainJpy: Decimal;
  holdingPeriodCategory: HoldingPeriodCategory;
  /** 実際に適用された3,000万円特別控除額(譲渡益が3,000万円未満の場合はその金額が上限) */
  specialDeductionAppliedJpy: Decimal;
  /** 特別控除後の課税譲渡所得金額 */
  taxableGainJpy: Decimal;
  /** 軽減税率の特例が実際に適用されたか(所有期間10年超・長期譲渡所得であることが前提) */
  reducedRateApplied: boolean;
  /** 税率区分ごとの内訳(軽減税率適用時は6,000万円以下の部分と超える部分に分かれる) */
  portions: HomeSaleTaxRatePortion[];
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

export function simulateHomeSaleTax(
  input: HomeSaleTaxSimulationInput,
): HomeSaleTaxSimulationResult {
  const transferPriceJpy = new Decimal(input.transferPriceJpy);
  const acquisitionCostJpy = new Decimal(input.acquisitionCostJpy);
  const transferExpensesJpy = new Decimal(input.transferExpensesJpy);

  requireNonNegative(transferPriceJpy, "譲渡価額");
  requireNonNegative(acquisitionCostJpy, "取得費");
  requireNonNegative(transferExpensesJpy, "譲渡費用");
  if (!Number.isInteger(input.ownershipYears) || input.ownershipYears < 0) {
    throw new Error("所有期間(年)は0以上の整数である必要があります");
  }

  const transferGainJpy = transferPriceJpy.minus(acquisitionCostJpy).minus(transferExpensesJpy);
  const holdingPeriodCategory: HoldingPeriodCategory =
    input.ownershipYears > SHORT_TERM_MAX_OWNERSHIP_YEARS ? "LONG_TERM" : "SHORT_TERM";

  const notes: string[] = [
    "租税特別措置法35条(居住用財産の3,000万円特別控除)・31条の3(所有期間10年超の居住用財産の軽減税率の特例)に基づく概算値。いずれも自己の居住用財産であること、配偶者・直系血族等特別の関係がある者への譲渡でないこと、前年・前々年に同一の特例の適用を受けていないこと等の適用要件の判定は行わないため、必ず国税庁タックスアンサーNo.3302・No.3305等で自身の適用可否を確認すること。",
    "所有期間は譲渡した年の1月1日時点で判定する(実際の保有期間ではない点に注意)。5年以下は短期譲渡所得(税率合計39.63%)、5年超は長期譲渡所得(税率合計20.315%)。",
  ];

  if (transferGainJpy.lessThanOrEqualTo(0)) {
    notes.push(
      "譲渡損失(譲渡価額が取得費・譲渡費用の合計以下)のため税額は生じない。マイホームの買換え等に伴う譲渡損失の損益通算・繰越控除(措置法41条の5・41条の5の2)は別制度のため本ツールでは試算しない。",
    );
    return {
      transferGainJpy,
      holdingPeriodCategory,
      specialDeductionAppliedJpy: new Decimal(0),
      taxableGainJpy: new Decimal(0),
      reducedRateApplied: false,
      portions: [],
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
    notes.push("3,000万円特別控除は未適用として試算した(specialDeductionEligible=false)。");
  }

  const taxableGainJpy = transferGainJpy.minus(specialDeductionAppliedJpy);

  const canApplyReducedRate =
    input.reducedRateEligible &&
    holdingPeriodCategory === "LONG_TERM" &&
    input.ownershipYears > REDUCED_RATE_MIN_OWNERSHIP_YEARS;

  if (input.reducedRateEligible && !canApplyReducedRate) {
    notes.push(
      `軽減税率の特例は所有期間が10年を超える場合のみ対象のため(入力値: ${input.ownershipYears}年)、今回は適用しなかった。`,
    );
  }

  const portions: HomeSaleTaxRatePortion[] = [];

  if (canApplyReducedRate) {
    const reducedPortionJpy = Decimal.min(taxableGainJpy, REDUCED_RATE_PORTION_LIMIT_JPY);
    const normalPortionJpy = taxableGainJpy.minus(reducedPortionJpy);

    portions.push({
      label: "軽減税率適用部分(6,000万円以下)",
      taxableGainJpy: reducedPortionJpy,
      nationalTaxJpy: reducedPortionJpy.times(REDUCED_NATIONAL_TAX_RATE),
      residentTaxJpy: reducedPortionJpy.times(REDUCED_RESIDENT_TAX_RATE),
    });
    if (normalPortionJpy.greaterThan(0)) {
      portions.push({
        label: "通常の長期譲渡所得の税率が適用される部分(6,000万円超)",
        taxableGainJpy: normalPortionJpy,
        nationalTaxJpy: normalPortionJpy.times(LONG_TERM_NATIONAL_TAX_RATE),
        residentTaxJpy: normalPortionJpy.times(LONG_TERM_RESIDENT_TAX_RATE),
      });
    }
  } else {
    const nationalRate =
      holdingPeriodCategory === "LONG_TERM" ? LONG_TERM_NATIONAL_TAX_RATE : SHORT_TERM_NATIONAL_TAX_RATE;
    const residentRate =
      holdingPeriodCategory === "LONG_TERM" ? LONG_TERM_RESIDENT_TAX_RATE : SHORT_TERM_RESIDENT_TAX_RATE;
    portions.push({
      label: holdingPeriodCategory === "LONG_TERM" ? "長期譲渡所得" : "短期譲渡所得",
      taxableGainJpy,
      nationalTaxJpy: taxableGainJpy.times(nationalRate),
      residentTaxJpy: taxableGainJpy.times(residentRate),
    });
  }

  const nationalTaxJpy = portions.reduce((sum, p) => sum.plus(p.nationalTaxJpy), new Decimal(0));
  const residentTaxJpy = portions.reduce((sum, p) => sum.plus(p.residentTaxJpy), new Decimal(0));

  return {
    transferGainJpy,
    holdingPeriodCategory,
    specialDeductionAppliedJpy,
    taxableGainJpy,
    reducedRateApplied: canApplyReducedRate,
    portions,
    nationalTaxJpy,
    residentTaxJpy,
    totalTaxJpy: nationalTaxJpy.plus(residentTaxJpy),
    notes,
  };
}
