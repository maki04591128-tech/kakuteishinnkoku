/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`addCryptoTrade`/`deleteCryptoTrade`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(入力検証・リポジトリ呼び出し・
 * 次の遷移先の決定)をコア関数として切り出した。3-12〜3-25で扱った「発生年の入力
 * のみの単純な年単位レコード(1年に1件)の登録/削除」パターンとは異なり、これは
 * 「取引記録(1年に複数件登録できるレコード)1件ごとの追加・削除」という
 * フェーズ3で初めて扱うパターン。暗号資産取引(CryptoTrade)は年の指定以外に
 * 特別なバリデーション(`addInvestmentTrade`のNISA判定等)が無い最も単純な
 * 取引記録のため、このパターンの最初の対象に選んだ。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { CryptoTradeRepository } from "@/lib/repositories/cryptoTradeRepository";

export interface AddCryptoTradeInput {
  year: number;
  tradedAt: string;
  symbol: string;
  type: string;
  quantity: string;
  unitPriceJpy: string;
  marketValueUnitPriceJpy: string | null;
  feeJpy: string | null;
  exchange: string | null;
  memo: string | null;
}

export interface DeleteCryptoTradeInput {
  id: number;
  year: number;
}

export interface CryptoTradeActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function addCryptoTradeCore(
  taxYearRepository: TaxYearRepository,
  cryptoTradeRepository: CryptoTradeRepository,
  input: AddCryptoTradeInput,
): Promise<CryptoTradeActionResult> {
  const {
    year,
    tradedAt,
    symbol,
    type,
    quantity,
    unitPriceJpy,
    marketValueUnitPriceJpy,
    feeJpy,
    exchange,
    memo,
  } = input;

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await cryptoTradeRepository.create({
    taxYearId: taxYear.id,
    tradedAt: new Date(tradedAt),
    symbol: symbol.toUpperCase(),
    type: type as never,
    quantity,
    unitPriceJpy,
    marketValueUnitPriceJpy,
    feeJpy: feeJpy ?? "0",
    exchange,
    memo,
    source: "manual",
  });

  return { redirectTo: `/import?year=${year}&tab=crypto` };
}

export async function deleteCryptoTradeCore(
  cryptoTradeRepository: CryptoTradeRepository,
  input: DeleteCryptoTradeInput,
): Promise<CryptoTradeActionResult> {
  const { id, year } = input;

  await cryptoTradeRepository.delete(id);

  return { redirectTo: `/import?year=${year}&tab=crypto` };
}
