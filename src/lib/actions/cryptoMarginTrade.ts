/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`addCryptoMarginTrade`/`deleteCryptoMarginTrade`から、
 * Next.js固有のAPI(`revalidatePath`/`redirect`)に依存しない部分を
 * コア関数として切り出した。3-26の`addCryptoTrade`/`deleteCryptoTrade`と同じ
 * 「取引記録(1年に複数件登録できるレコード)1件ごとの追加・削除」パターンの
 * 2例目(暗号資産の先物・証拠金取引。`addInvestmentTrade`のNISA判定のような
 * 追加バリデーションは無く、symbolの大文字化・feeJpy/swapJpy省略時の
 * "0"補完のみ)。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { CryptoMarginTradeRepository } from "@/lib/repositories/cryptoMarginTradeRepository";

export interface AddCryptoMarginTradeInput {
  year: number;
  settledAt: string;
  symbol: string;
  realizedPnlJpy: string;
  feeJpy: string | null;
  swapJpy: string | null;
  exchange: string | null;
  memo: string | null;
}

export interface DeleteCryptoMarginTradeInput {
  id: number;
  year: number;
}

export interface CryptoMarginTradeActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function addCryptoMarginTradeCore(
  taxYearRepository: TaxYearRepository,
  cryptoMarginTradeRepository: CryptoMarginTradeRepository,
  input: AddCryptoMarginTradeInput,
): Promise<CryptoMarginTradeActionResult> {
  const { year, settledAt, symbol, realizedPnlJpy, feeJpy, swapJpy, exchange, memo } = input;

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await cryptoMarginTradeRepository.create({
    taxYearId: taxYear.id,
    settledAt: new Date(settledAt),
    symbol: symbol.toUpperCase(),
    realizedPnlJpy,
    feeJpy: feeJpy ?? "0",
    swapJpy: swapJpy ?? "0",
    exchange,
    memo,
    source: "manual",
  });

  return { redirectTo: `/import?year=${year}&tab=cryptoMargin` };
}

export async function deleteCryptoMarginTradeCore(
  cryptoMarginTradeRepository: CryptoMarginTradeRepository,
  input: DeleteCryptoMarginTradeInput,
): Promise<CryptoMarginTradeActionResult> {
  const { id, year } = input;

  await cryptoMarginTradeRepository.delete(id);

  return { redirectTo: `/import?year=${year}&tab=cryptoMargin` };
}
