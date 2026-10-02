/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`setMarketPrice`/`deleteMarketPrice`から、Next.js固有の
 * API(`redirect`)に依存しない部分(入力の整形・リポジトリ呼び出し・次の遷移先の
 * 決定)をコア関数として切り出した。`MarketPriceRepository`は依存リポジトリが
 * 1つだけの単純なアクションのため、3-2の`setCryptoCostMethod`・3-3の
 * `setAssetSymbolMapping`に続くパターン適用の3例目として選んだ。
 */
import type { MarketPriceRepository } from "@/lib/repositories/marketPriceRepository";

export interface SetMarketPriceInput {
  year: number;
  symbol: string;
  priceJpy: string;
}

export interface DeleteMarketPriceInput {
  id: number;
  year: number;
}

export interface MarketPriceActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function setMarketPriceCore(
  marketPriceRepository: MarketPriceRepository,
  input: SetMarketPriceInput,
): Promise<MarketPriceActionResult> {
  const { year, symbol, priceJpy } = input;

  await marketPriceRepository.upsert({
    symbol: symbol.trim().toUpperCase(),
    priceJpy: priceJpy.trim(),
  });

  return { redirectTo: `/import?year=${year}&tab=assetBalance` };
}

export async function deleteMarketPriceCore(
  marketPriceRepository: MarketPriceRepository,
  input: DeleteMarketPriceInput,
): Promise<MarketPriceActionResult> {
  const { id, year } = input;

  await marketPriceRepository.delete(id);

  return { redirectTo: `/import?year=${year}&tab=assetBalance` };
}
