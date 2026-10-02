/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`setAssetSymbolMapping`/`deleteAssetSymbolMapping`から、
 * Next.js固有のAPI(`redirect`)に依存しない部分(入力の整形・リポジトリ呼び出し・
 * 次の遷移先の決定)をコア関数として切り出した。`AssetSymbolMappingRepository`は
 * 依存リポジトリが1つだけの単純なアクションのため、3-2の`setCryptoCostMethod`に
 * 続くパターン適用の2例目として選んだ。
 */
import type { AssetSymbolMappingRepository } from "@/lib/repositories/assetSymbolMappingRepository";

export interface SetAssetSymbolMappingInput {
  year: number;
  assetName: string;
  symbol: string;
}

export interface DeleteAssetSymbolMappingInput {
  id: number;
  year: number;
}

export interface AssetSymbolMappingActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function setAssetSymbolMappingCore(
  assetSymbolMappingRepository: AssetSymbolMappingRepository,
  input: SetAssetSymbolMappingInput,
): Promise<AssetSymbolMappingActionResult> {
  const { year, assetName, symbol } = input;

  await assetSymbolMappingRepository.upsert({
    assetName: assetName.trim(),
    symbol: symbol.trim().toUpperCase(),
  });

  return { redirectTo: `/import?year=${year}&tab=assetBalance` };
}

export async function deleteAssetSymbolMappingCore(
  assetSymbolMappingRepository: AssetSymbolMappingRepository,
  input: DeleteAssetSymbolMappingInput,
): Promise<AssetSymbolMappingActionResult> {
  const { id, year } = input;

  await assetSymbolMappingRepository.delete(id);

  return { redirectTo: `/import?year=${year}&tab=assetBalance` };
}
