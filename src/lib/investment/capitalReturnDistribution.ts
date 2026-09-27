import { Decimal } from "decimal.js";

/**
 * 上場投資法人(J-REIT)等が行う「出資等減少分配」(利益超過分配金のうち出資剰余金を
 * 原資とする部分。一般に「その他の利益超過分配金」等と呼ばれる)を受け取った個人投資主の
 * 課税関係を試算する。
 *
 * 出資等減少分配は、株式会社の資本剰余金を原資とする配当に相当するもので、所得税法24条
 * 1項が通常の配当所得の定義から除外している(「金銭の分配(出資総額等の減少に伴う金銭の
 * 分配として財務省令で定めるもの(次条第一項第四号において「出資等減少分配」という。)を
 * 除く。)」)。その代わり、次の2つの課税関係が生じる(所得税法25条1項4号・同法施行令61条
 * 2項5号・同法施行令114条1項2号)。
 *
 * 1. みなし配当(所得税法25条1項) — 分配額のうち投資法人の資本金等の額に対応する部分
 *    (分配対応資本金額等)を超える部分は配当所得とみなされる。
 * 2. みなし譲渡損益(措置法37条の11第3項) — 投資口の一部を払戻等割合相当分だけ譲渡した
 *    ものとみなし、次の額を上場株式等の譲渡所得等として計算する。
 *      みなし譲渡収入金額 = 出資等減少分配額 - みなし配当額
 *      投資口の譲渡原価   = 従前の取得価額の合計額 × 払戻等割合
 *      みなし譲渡損益     = みなし譲渡収入金額 - 投資口の譲渡原価
 *    あわせて、残った投資口の取得価額も同じ払戻等割合で調整(減額)される
 *    (所得税法施行令114条1項2号)。
 *      新しい取得価額 = 従前の取得価額 - 従前の取得価額 × 払戻等割合
 *
 * ここで「払戻等割合」(所得税法施行令61条2項5号に規定する割合)は、投資法人の資産・負債の
 * 帳簿価額と出資総額等減少額から計算される値だが、投資法人には施行令114条2項によりこの
 * 割合を投資主へ通知する義務があるため(実際に各投資法人が分配のたびに投資主へ送付する
 * 「分配金の税務上の取扱いに関するご説明」等の書面に記載される)、本モジュールは投資法人
 * から通知される払戻等割合・みなし配当額をそのまま入力として受け取り、財務諸表からの
 * 算出は行わない(大和ハウスリート投資法人「第33期 分配金の税務上の取扱いに関するご説明」
 * (2022年11月11日付)を実例として、算式・数値例を確認した)。
 *
 * 投資信託の特別分配金(元本払戻金。`distributionClassification.ts`。所得税法9条1項11号・
 * 同法施行令27条)とは非課税・みなし譲渡課税という点で異なる別制度である点に注意
 * (機能145参照)。
 *
 * **対象外とした範囲(今後の課題):**
 * - 払戻等割合・みなし配当額そのものを投資法人の資産・負債の帳簿価額から算出すること
 *   (投資法人からの通知値をそのまま使う前提のため対象外)。
 * - 「一時差異等調整引当額」等、出資等減少分配に該当しない利益超過分配金(税務上は通常の
 *   利益分配金と合算した配当所得として扱われ、取得価額の調整もみなし譲渡損益も生じない。
 *   `dividendTaxSimulation.ts`でそのまま試算できる)。
 * - みなし配当に係る源泉徴収税額の計算(源泉徴収は投資法人側で行われるため対象外。本
 *   モジュールは確定申告書に記載する配当所得・譲渡所得等の金額の計算のみを対象とする)。
 * - 特定口座(源泉徴収あり)を株式数比例配分方式で利用している場合に、証券会社側で
 *   みなし譲渡損益の計算・特定口座内の損益通算までが行われ確定申告が不要となる場合が
 *   ある点(本ツールの試算結果と一致するかはユーザー自身の確認事項とする)。
 * - NISA口座(非課税管理勘定)で保有する場合の特則(みなし譲渡益は非課税、みなし譲渡損は
 *   生じなかったものとみなされる)。
 */

export interface CapitalReturnDistributionEvent {
  /** 区別のための任意のラベル(例: 決算期) */
  label?: string;
  /** 1口当たりの出資等減少分配額(その他の利益超過分配金等) */
  distributionPerUnitJpy: Decimal.Value;
  /** 1口当たりのみなし配当額(投資法人から通知される額。該当なしなら0) */
  deemedDividendPerUnitJpy: Decimal.Value;
  /** 払戻等割合(投資法人から通知される、所得税法施行令61条2項5号に規定する割合。0以上1以下) */
  paybackRatio: Decimal.Value;
}

export interface CapitalReturnDistributionEventResult {
  label: string;
  /** この分配の直前の1口当たり取得価額 */
  openingAcquisitionCostPerUnitJpy: Decimal;
  /** みなし配当額(実額) */
  deemedDividendJpy: Decimal;
  /** みなし譲渡収入金額(実額) */
  deemedTransferProceedsJpy: Decimal;
  /** 投資口の譲渡原価(実額) */
  deemedAcquisitionCostJpy: Decimal;
  /** みなし譲渡損益(実額。正なら譲渡益、負なら譲渡損) */
  deemedTransferGainLossJpy: Decimal;
  /** この分配後の1口当たり取得価額 */
  closingAcquisitionCostPerUnitJpy: Decimal;
}

export interface CapitalReturnDistributionResult {
  events: CapitalReturnDistributionEventResult[];
  /** みなし配当額の合計(実額。配当所得) */
  totalDeemedDividendJpy: Decimal;
  /** みなし譲渡損益の合計(実額。上場株式等の譲渡所得等) */
  totalDeemedTransferGainLossJpy: Decimal;
  /** 最終的な1口当たり取得価額(次回以降の分配・将来の売却時の取得費計算に使用) */
  closingAcquisitionCostPerUnitJpy: Decimal;
  /** 最終的な取得価額の合計(実額) */
  closingTotalAcquisitionCostJpy: Decimal;
  notes: string[];
}

function toDecimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label}は正の整数である必要があります`);
  }
}

function requireRatioInRange(value: Decimal, label: string): void {
  if (value.isNegative() || value.greaterThan(1)) {
    throw new Error(`${label}は0以上1以下である必要があります`);
  }
}

/**
 * 保有口数を一定として、一連の出資等減少分配を古い順に処理し、分配ごとに
 * みなし配当額・みなし譲渡損益・取得価額の調整を計算する。取得価額は分配のたびに
 * 従前の取得価額×払戻等割合の分だけ減少し、次の分配へ引き継がれる。
 */
export function calculateCapitalReturnDistributions(
  openingAcquisitionCostPerUnitJpy: Decimal.Value,
  holdingUnits: number,
  events: CapitalReturnDistributionEvent[],
): CapitalReturnDistributionResult {
  requirePositiveInteger(holdingUnits, "保有口数");
  let acquisitionCostPerUnit = toDecimal(openingAcquisitionCostPerUnitJpy);
  requireNonNegative(acquisitionCostPerUnit, "取得価額");

  const results: CapitalReturnDistributionEventResult[] = events.map((event, index) => {
    const label = event.label?.trim() || `分配${index + 1}`;
    const distributionPerUnit = toDecimal(event.distributionPerUnitJpy);
    const deemedDividendPerUnit = toDecimal(event.deemedDividendPerUnitJpy);
    const paybackRatio = toDecimal(event.paybackRatio);
    requireNonNegative(distributionPerUnit, "出資等減少分配額");
    requireNonNegative(deemedDividendPerUnit, "みなし配当額");
    requireRatioInRange(paybackRatio, "払戻等割合");
    if (deemedDividendPerUnit.greaterThan(distributionPerUnit)) {
      throw new Error("みなし配当額は出資等減少分配額を超えることはできません");
    }

    const openingAcquisitionCostPerUnit = acquisitionCostPerUnit;
    const deemedTransferProceedsPerUnit = distributionPerUnit.minus(deemedDividendPerUnit);
    const deemedAcquisitionCostPerUnit = openingAcquisitionCostPerUnit.times(paybackRatio);
    const deemedTransferGainLossPerUnit = deemedTransferProceedsPerUnit.minus(
      deemedAcquisitionCostPerUnit,
    );
    const closingAcquisitionCostPerUnit = openingAcquisitionCostPerUnit.minus(
      deemedAcquisitionCostPerUnit,
    );

    acquisitionCostPerUnit = closingAcquisitionCostPerUnit;

    const units = new Decimal(holdingUnits);
    return {
      label,
      openingAcquisitionCostPerUnitJpy: openingAcquisitionCostPerUnit,
      deemedDividendJpy: deemedDividendPerUnit.times(units),
      deemedTransferProceedsJpy: deemedTransferProceedsPerUnit.times(units),
      deemedAcquisitionCostJpy: deemedAcquisitionCostPerUnit.times(units),
      deemedTransferGainLossJpy: deemedTransferGainLossPerUnit.times(units),
      closingAcquisitionCostPerUnitJpy: closingAcquisitionCostPerUnit,
    };
  });

  const totalDeemedDividendJpy = results.reduce(
    (sum, r) => sum.plus(r.deemedDividendJpy),
    new Decimal(0),
  );
  const totalDeemedTransferGainLossJpy = results.reduce(
    (sum, r) => sum.plus(r.deemedTransferGainLossJpy),
    new Decimal(0),
  );

  const notes: string[] = [
    "上場投資法人(J-REIT)等の出資等減少分配(利益超過分配金のうち出資剰余金を原資とする部分)は、通常の配当所得の定義から除外され(所得税法24条1項)、分配額のうち投資法人の資本金等の額に対応する部分を超える部分だけがみなし配当となる(所得税法25条1項4号)。",
    "みなし配当を除いた部分は投資口の一部を払戻等割合相当分だけ譲渡したものとみなされ(措置法37条の11第3項)、みなし譲渡収入金額から投資口の譲渡原価(従前の取得価額の合計額×払戻等割合)を控除した額が上場株式等の譲渡所得等として他の株式等の譲渡損益と通算できる。",
    "払戻等割合・みなし配当額(1口当たり)は投資法人が投資主へ通知する義務を負う値(所得税法施行令114条2項)をそのまま入力する。財務諸表からの算出は対象外。",
    "残った投資口の取得価額も同じ払戻等割合だけ減額され(所得税法施行令114条1項2号)、次回以降の分配・将来の売却時の取得費計算に引き継がれる。",
    "「一時差異等調整引当額」等、出資等減少分配に該当しない利益超過分配金は通常の利益分配金と合算した配当所得として扱われ、取得価額の調整もみなし譲渡損益も生じない(配当所得の課税方式は`/dividend-simulation`で試算できる)。",
    "特定口座(源泉徴収あり)を株式数比例配分方式で利用している場合、みなし譲渡損益の計算・特定口座内での損益通算が証券会社側で行われ確定申告が不要となる場合がある。本ツールの試算結果と一致するかはユーザー自身で確認すること。NISA口座(非課税管理勘定)で保有する場合、みなし譲渡益は非課税、みなし譲渡損は生じなかったものとみなされる。",
  ];

  return {
    events: results,
    totalDeemedDividendJpy,
    totalDeemedTransferGainLossJpy,
    closingAcquisitionCostPerUnitJpy: acquisitionCostPerUnit,
    closingTotalAcquisitionCostJpy: acquisitionCostPerUnit.times(holdingUnits),
    notes,
  };
}
