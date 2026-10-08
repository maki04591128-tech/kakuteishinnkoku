// スタンドアロン版ビルド用の
// `@/lib/repositories/defaultAssetBalanceSnapshotRepository`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3b)。
//
// フェーズ5-1-3bの時点ではブラウザ向け(OPFSベース)の`openClientDb`実装が
// 無かったため、各メソッド呼び出し時にエラーを投げるだけのプレースホルダーに
// していた。フェーズ5-3でブラウザ向け実装(`../clientDb/sqlite.browser.ts`)が
// 用意され、5-3-2で`TaxYearRepository`を結線したパターンを、本ステップ(5-3-3)で
// このモデルにも適用する。`getStandaloneClientDb()`
// (`../clientDb/standaloneClientDb.ts`)がアプリ全体で共有する`ClientDb`接続を
// 遅延オープンし、`createClientAssetBalanceSnapshotRepository`
// (wa-sqlite実装。`./assetBalanceSnapshotRepository.ts`)に渡す。
import { createClientAssetBalanceSnapshotRepository } from "./assetBalanceSnapshotRepository";
import type { AssetBalanceSnapshotRepository } from "./assetBalanceSnapshotRepository";
import { getStandaloneClientDb } from "../clientDb/standaloneClientDb";

async function getRepository(): Promise<AssetBalanceSnapshotRepository> {
  const db = await getStandaloneClientDb();
  return createClientAssetBalanceSnapshotRepository(db);
}

export const assetBalanceSnapshotRepository: AssetBalanceSnapshotRepository = {
  async findByTaxYearId(taxYearId) {
    const repository = await getRepository();
    return repository.findByTaxYearId(taxYearId);
  },

  async findImportBatchesWithSnapshots(input) {
    const repository = await getRepository();
    return repository.findImportBatchesWithSnapshots(input);
  },

  async importCsvBatch(input) {
    const repository = await getRepository();
    return repository.importCsvBatch(input);
  },

  async deleteImportBatch(importBatchId) {
    const repository = await getRepository();
    return repository.deleteImportBatch(importBatchId);
  },
};
