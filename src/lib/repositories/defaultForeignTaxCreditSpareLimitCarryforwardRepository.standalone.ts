// スタンドアロン版ビルド用の
// `@/lib/repositories/defaultForeignTaxCreditSpareLimitCarryforwardRepository`差し替え
// 実装(next.config.tsのresolveAlias経由。フェーズ5-1-3d-16)。
//
// フェーズ5-1-3bの時点ではブラウザ向け(OPFSベース)の`openClientDb`実装が
// 無かったため、各メソッド呼び出し時にエラーを投げるだけのプレースホルダーに
// していた。フェーズ5-3でブラウザ向け実装(`../clientDb/sqlite.browser.ts`)が
// 用意され、5-3-2で`TaxYearRepository`向けに確立したパターンを、本ステップ(5-3-3)で
// このモデルにも適用する。`getStandaloneClientDb()`
// (`../clientDb/standaloneClientDb.ts`)がアプリ全体で共有する`ClientDb`接続を
// 遅延オープンし、`createClientForeignTaxCreditSpareLimitCarryforwardRepository`
// (wa-sqlite実装。`./foreignTaxCreditSpareLimitCarryforwardRepository.ts`)に渡す。
import { createClientForeignTaxCreditSpareLimitCarryforwardRepository } from "./foreignTaxCreditSpareLimitCarryforwardRepository";
import type { ForeignTaxCreditSpareLimitCarryforwardRepository } from "./foreignTaxCreditSpareLimitCarryforwardRepository";
import { getStandaloneClientDb } from "../clientDb/standaloneClientDb";

async function getRepository(): Promise<ForeignTaxCreditSpareLimitCarryforwardRepository> {
  const db = await getStandaloneClientDb();
  return createClientForeignTaxCreditSpareLimitCarryforwardRepository(db);
}

export const foreignTaxCreditSpareLimitCarryforwardRepository: ForeignTaxCreditSpareLimitCarryforwardRepository =
  {
    async findByTaxYearId(taxYearId) {
      const repository = await getRepository();
      return repository.findByTaxYearId(taxYearId);
    },

    async upsert(params) {
      const repository = await getRepository();
      return repository.upsert(params);
    },

    async delete(id) {
      const repository = await getRepository();
      return repository.delete(id);
    },

    async createMany(data) {
      const repository = await getRepository();
      return repository.createMany(data);
    },
  };
