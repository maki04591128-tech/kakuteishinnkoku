/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`deleteAssetBalanceImportBatch`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(リポジトリ呼び出し・次の遷移先の
 * 決定)をコア関数として切り出した。`AssetBalanceSnapshotRepository`は5-1-3bで
 * 既にビルドターゲット切り替え機構を適用済みのため、5-1-3d-39の対応として本関数を
 * 追加する。
 */
import type { AssetBalanceSnapshotRepository } from "@/lib/repositories/assetBalanceSnapshotRepository";

export interface DeleteAssetBalanceImportBatchInput {
  importBatchId: number;
  year: number;
}

export interface DeleteAssetBalanceImportBatchResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function deleteAssetBalanceImportBatchCore(
  assetBalanceSnapshotRepository: AssetBalanceSnapshotRepository,
  input: DeleteAssetBalanceImportBatchInput,
): Promise<DeleteAssetBalanceImportBatchResult> {
  const { importBatchId, year } = input;

  await assetBalanceSnapshotRepository.deleteImportBatch(importBatchId);

  return { redirectTo: `/import?year=${year}&tab=assetBalance` };
}
