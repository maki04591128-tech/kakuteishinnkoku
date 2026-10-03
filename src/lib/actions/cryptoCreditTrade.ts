/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`addCryptoCreditTrade`/`deleteCryptoCreditTrade`から、
 * Next.js固有のAPI(`revalidatePath`/`redirect`)に依存しない部分を
 * コア関数として切り出した。3-26の`addCryptoTrade`/`deleteCryptoTrade`・3-27の
 * `addCryptoMarginTrade`/`deleteCryptoMarginTrade`と同じ「取引記録(1年に複数件
 * 登録できるレコード)1件ごとの追加・削除」パターンの3例目(暗号資産の
 * クレジット取引。`addInvestmentTrade`のNISA判定のような追加バリデーションは
 * 無く、symbolの大文字化・feeJpy/interestAdjustmentJpy省略時の"0"補完のみ)。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { CryptoCreditTradeRepository } from "@/lib/repositories/cryptoCreditTradeRepository";

export interface AddCryptoCreditTradeInput {
  year: number;
  settledAt: string;
  symbol: string;
  realizedPnlJpy: string;
  feeJpy: string | null;
  interestAdjustmentJpy: string | null;
  exchange: string | null;
  memo: string | null;
}

export interface DeleteCryptoCreditTradeInput {
  id: number;
  year: number;
}

export interface CryptoCreditTradeActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function addCryptoCreditTradeCore(
  taxYearRepository: TaxYearRepository,
  cryptoCreditTradeRepository: CryptoCreditTradeRepository,
  input: AddCryptoCreditTradeInput,
): Promise<CryptoCreditTradeActionResult> {
  const { year, settledAt, symbol, realizedPnlJpy, feeJpy, interestAdjustmentJpy, exchange, memo } =
    input;

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await cryptoCreditTradeRepository.create({
    taxYearId: taxYear.id,
    settledAt: new Date(settledAt),
    symbol: symbol.toUpperCase(),
    realizedPnlJpy,
    feeJpy: feeJpy ?? "0",
    interestAdjustmentJpy: interestAdjustmentJpy ?? "0",
    exchange,
    memo,
  });

  return { redirectTo: `/import?year=${year}&tab=cryptoCredit` };
}

export async function deleteCryptoCreditTradeCore(
  cryptoCreditTradeRepository: CryptoCreditTradeRepository,
  input: DeleteCryptoCreditTradeInput,
): Promise<CryptoCreditTradeActionResult> {
  const { id, year } = input;

  await cryptoCreditTradeRepository.delete(id);

  return { redirectTo: `/import?year=${year}&tab=cryptoCredit` };
}
