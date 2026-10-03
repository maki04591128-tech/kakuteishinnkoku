/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`addStockMarginTrade`/`deleteStockMarginTrade`から、
 * Next.js固有のAPI(`revalidatePath`/`redirect`)に依存しない部分を
 * コア関数として切り出した。3-26の`addCryptoTrade`/`deleteCryptoTrade`・3-27の
 * `addCryptoMarginTrade`/`deleteCryptoMarginTrade`・3-28の
 * `addCryptoCreditTrade`/`deleteCryptoCreditTrade`と同じ「取引記録(1年に複数件
 * 登録できるレコード)1件ごとの追加・削除」パターンの4例目(株式の信用取引。
 * `addInvestmentTrade`のNISA判定のような追加バリデーションは無く、symbolの
 * 大文字化・feeJpy/interestAdjustmentJpy省略時の"0"補完のみ)。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { StockMarginTradeRepository } from "@/lib/repositories/stockMarginTradeRepository";

export interface AddStockMarginTradeInput {
  year: number;
  settledAt: string;
  symbol: string;
  realizedPnlJpy: string;
  feeJpy: string | null;
  interestAdjustmentJpy: string | null;
  broker: string | null;
  memo: string | null;
}

export interface DeleteStockMarginTradeInput {
  id: number;
  year: number;
}

export interface StockMarginTradeActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function addStockMarginTradeCore(
  taxYearRepository: TaxYearRepository,
  stockMarginTradeRepository: StockMarginTradeRepository,
  input: AddStockMarginTradeInput,
): Promise<StockMarginTradeActionResult> {
  const { year, settledAt, symbol, realizedPnlJpy, feeJpy, interestAdjustmentJpy, broker, memo } =
    input;

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await stockMarginTradeRepository.create({
    taxYearId: taxYear.id,
    settledAt: new Date(settledAt),
    symbol: symbol.toUpperCase(),
    realizedPnlJpy,
    feeJpy: feeJpy ?? "0",
    interestAdjustmentJpy: interestAdjustmentJpy ?? "0",
    broker,
    memo,
  });

  return { redirectTo: `/import?year=${year}&tab=stockMargin` };
}

export async function deleteStockMarginTradeCore(
  stockMarginTradeRepository: StockMarginTradeRepository,
  input: DeleteStockMarginTradeInput,
): Promise<StockMarginTradeActionResult> {
  const { id, year } = input;

  await stockMarginTradeRepository.delete(id);

  return { redirectTo: `/import?year=${year}&tab=stockMargin` };
}
