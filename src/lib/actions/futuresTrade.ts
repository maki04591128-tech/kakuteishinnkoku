/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`addFuturesTrade`/`deleteFuturesTrade`から、
 * Next.js固有のAPI(`revalidatePath`/`redirect`)に依存しない部分を
 * コア関数として切り出した。3-26の`addCryptoTrade`/`deleteCryptoTrade`・3-27の
 * `addCryptoMarginTrade`/`deleteCryptoMarginTrade`・3-28の
 * `addCryptoCreditTrade`/`deleteCryptoCreditTrade`・3-29の
 * `addStockMarginTrade`/`deleteStockMarginTrade`と同じ「取引記録(1年に複数件
 * 登録できるレコード)1件ごとの追加・削除」パターンの5例目(先物取引。
 * symbolの大文字化は元の`actions.ts`側にも無く、feeJpy/swapJpy省略時の
 * "0"補完と`source: "manual"`固定のみ)。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { FuturesTradeRepository } from "@/lib/repositories/futuresTradeRepository";

export interface AddFuturesTradeInput {
  year: number;
  settledAt: string;
  symbol: string;
  realizedPnlJpy: string;
  feeJpy: string | null;
  swapJpy: string | null;
  broker: string | null;
  memo: string | null;
}

export interface DeleteFuturesTradeInput {
  id: number;
  year: number;
}

export interface FuturesTradeActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function addFuturesTradeCore(
  taxYearRepository: TaxYearRepository,
  futuresTradeRepository: FuturesTradeRepository,
  input: AddFuturesTradeInput,
): Promise<FuturesTradeActionResult> {
  const { year, settledAt, symbol, realizedPnlJpy, feeJpy, swapJpy, broker, memo } = input;

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await futuresTradeRepository.create({
    taxYearId: taxYear.id,
    settledAt: new Date(settledAt),
    symbol,
    realizedPnlJpy,
    feeJpy: feeJpy ?? "0",
    swapJpy: swapJpy ?? "0",
    broker,
    memo,
    source: "manual",
  });

  return { redirectTo: `/import?year=${year}&tab=futures` };
}

export async function deleteFuturesTradeCore(
  futuresTradeRepository: FuturesTradeRepository,
  input: DeleteFuturesTradeInput,
): Promise<FuturesTradeActionResult> {
  const { id, year } = input;

  await futuresTradeRepository.delete(id);

  return { redirectTo: `/import?year=${year}&tab=futures` };
}
