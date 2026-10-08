// スタンドアロン版ビルド用の
// `@/lib/repositories/defaultForeignTaxCreditRecordRepository`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3b)。
//
// フェーズ5-1-3bの時点ではブラウザ向け(OPFSベース)の`openClientDb`実装が
// 無かったため、各メソッド呼び出し時にエラーを投げるだけのプレースホルダーに
// していた。フェーズ5-3でブラウザ向け実装(`../clientDb/sqlite.browser.ts`)が
// 用意され、5-3-2で`TaxYearRepository`向けに確立したパターンを、本ステップ(5-3-3)で
// このモデルにも適用する。`getStandaloneClientDb()`
// (`../clientDb/standaloneClientDb.ts`)がアプリ全体で共有する`ClientDb`接続を
// 遅延オープンし、`createClientForeignTaxCreditRecordRepository`
// (wa-sqlite実装。`./foreignTaxCreditRecordRepository.ts`)に渡す。
import { createClientForeignTaxCreditRecordRepository } from "./foreignTaxCreditRecordRepository";
import type { ForeignTaxCreditRecordRepository } from "./foreignTaxCreditRecordRepository";
import { getStandaloneClientDb } from "../clientDb/standaloneClientDb";

async function getRepository(): Promise<ForeignTaxCreditRecordRepository> {
  const db = await getStandaloneClientDb();
  return createClientForeignTaxCreditRecordRepository(db);
}

export const foreignTaxCreditRecordRepository: ForeignTaxCreditRecordRepository = {
  async findByTaxYearId(taxYearId) {
    const repository = await getRepository();
    return repository.findByTaxYearId(taxYearId);
  },

  async upsert(params) {
    const repository = await getRepository();
    return repository.upsert(params);
  },

  async deleteByTaxYearId(taxYearId) {
    const repository = await getRepository();
    return repository.deleteByTaxYearId(taxYearId);
  },
};
