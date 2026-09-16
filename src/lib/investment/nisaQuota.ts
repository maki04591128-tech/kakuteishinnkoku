import { Decimal } from "decimal.js";

/**
 * NISA(少額投資非課税制度)の年間投資枠の使用状況集計。
 *
 * 2024年以降の新NISA制度では、年間投資枠が「つみたて投資枠(120万円)」と
 * 「成長投資枠(240万円)」の2種類に分かれ、それぞれ独立して上限を管理する
 * (両方を使い切っても生涯投資枠の範囲内であれば非課税)。本モジュールは
 * その年にアプリへ登録された NISA口座の買付(type=BUY)取引を集計し、
 * 各枠の年間上限に対する使用状況を試算する。
 *
 * 簡略化している点:
 *  - 生涯非課税限度額(総枠1,800万円・うち成長投資枠1,200万円)は、
 *    売却による枠の再利用(簿価残高の翌年復活)やアプリ導入以前の取引を
 *    考慮する必要があり本ツールのデータだけでは正確に追えないため対象外とする。
 *    年間投資枠(暦年でリセットされ、その年の買付のみで判定できる)のみを試算する。
 *  - 買付金額は約定代金(数量×単価)を用い、手数料は含めない
 *    (NISA口座の買付は無手数料の証券会社が大半のため)。
 */

export const NISA_TSUMITATE_ANNUAL_LIMIT_JPY = new Decimal(1_200_000);
export const NISA_GROWTH_ANNUAL_LIMIT_JPY = new Decimal(2_400_000);

export type NisaQuotaType = "TSUMITATE" | "GROWTH";

export interface NisaQuotaTradeInput {
  type: "BUY" | "SELL" | "DIVIDEND";
  isNisa: boolean;
  /** isNisa=true かつ type=BUY の場合のみ意味を持つ */
  nisaType?: NisaQuotaType | null;
  quantity: Decimal.Value;
  unitPriceJpy: Decimal.Value;
}

export interface NisaQuotaUsageResult {
  tsumitateLimitJpy: Decimal;
  tsumitateUsedJpy: Decimal;
  tsumitateRemainingJpy: Decimal;
  growthLimitJpy: Decimal;
  growthUsedJpy: Decimal;
  growthRemainingJpy: Decimal;
  /** NISA口座の買付だが枠区分(nisaType)が未入力の取引の合計額。いずれの枠の使用額にも含めていない */
  unclassifiedBuyJpy: Decimal;
}

export function calculateNisaQuotaUsage(trades: NisaQuotaTradeInput[]): NisaQuotaUsageResult {
  let tsumitateUsedJpy = new Decimal(0);
  let growthUsedJpy = new Decimal(0);
  let unclassifiedBuyJpy = new Decimal(0);

  for (const trade of trades) {
    if (!trade.isNisa || trade.type !== "BUY") continue;
    const amount = new Decimal(trade.quantity).times(trade.unitPriceJpy);

    if (trade.nisaType === "TSUMITATE") {
      tsumitateUsedJpy = tsumitateUsedJpy.plus(amount);
    } else if (trade.nisaType === "GROWTH") {
      growthUsedJpy = growthUsedJpy.plus(amount);
    } else {
      unclassifiedBuyJpy = unclassifiedBuyJpy.plus(amount);
    }
  }

  return {
    tsumitateLimitJpy: NISA_TSUMITATE_ANNUAL_LIMIT_JPY,
    tsumitateUsedJpy,
    tsumitateRemainingJpy: NISA_TSUMITATE_ANNUAL_LIMIT_JPY.minus(tsumitateUsedJpy),
    growthLimitJpy: NISA_GROWTH_ANNUAL_LIMIT_JPY,
    growthUsedJpy,
    growthRemainingJpy: NISA_GROWTH_ANNUAL_LIMIT_JPY.minus(growthUsedJpy),
    unclassifiedBuyJpy,
  };
}
