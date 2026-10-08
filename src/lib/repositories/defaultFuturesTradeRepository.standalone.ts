// スタンドアロン版ビルド用の
// `@/lib/repositories/defaultFuturesTradeRepository`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3b)。
//
// フェーズ5-1-3bの時点ではブラウザ向け(OPFSベース)の`openClientDb`実装が
// 無かったため、各メソッド呼び出し時にエラーを投げるだけのプレースホルダーに
// していた。フェーズ5-3でブラウザ向け実装(`../clientDb/sqlite.browser.ts`)が
// 用意され、5-3-2で`TaxYearRepository`向けに確立したパターンを、本ステップ(5-3-3)で
// このモデルにも適用する。`getStandaloneClientDb()`
// (`../clientDb/standaloneClientDb.ts`)がアプリ全体で共有する`ClientDb`接続を
// 遅延オープンし、`createClientFuturesTradeRepository`
// (wa-sqlite実装。`./futuresTradeRepository.ts`)に渡す。
import { createClientFuturesTradeRepository } from "./futuresTradeRepository";
import type { FuturesTradeRepository } from "./futuresTradeRepository";
import { getStandaloneClientDb } from "../clientDb/standaloneClientDb";

async function getRepository(): Promise<FuturesTradeRepository> {
  const db = await getStandaloneClientDb();
  return createClientFuturesTradeRepository(db);
}

export const futuresTradeRepository: FuturesTradeRepository = {
  async findByTaxYearId(taxYearId) {
    const repository = await getRepository();
    return repository.findByTaxYearId(taxYearId);
  },

  async create(data) {
    const repository = await getRepository();
    return repository.create(data);
  },

  async delete(id) {
    const repository = await getRepository();
    return repository.delete(id);
  },

  async importCsvBatch(input) {
    const repository = await getRepository();
    return repository.importCsvBatch(input);
  },
};
