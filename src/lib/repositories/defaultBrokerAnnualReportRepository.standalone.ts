// スタンドアロン版ビルド用の
// `@/lib/repositories/defaultBrokerAnnualReportRepository`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3b)。
//
// フェーズ5-1-3bの時点ではブラウザ向け(OPFSベース)の`openClientDb`実装が
// 無かったため、各メソッド呼び出し時にエラーを投げるだけのプレースホルダーに
// していた。フェーズ5-3でブラウザ向け実装(`../clientDb/sqlite.browser.ts`)が
// 用意され、5-3-2で`TaxYearRepository`を結線したパターンを、本ステップ(5-3-3)で
// このモデルにも適用する。`getStandaloneClientDb()`
// (`../clientDb/standaloneClientDb.ts`)がアプリ全体で共有する`ClientDb`接続を
// 遅延オープンし、`createClientBrokerAnnualReportRepository`
// (wa-sqlite実装。`./brokerAnnualReportRepository.ts`)に渡す。
import { createClientBrokerAnnualReportRepository } from "./brokerAnnualReportRepository";
import type { BrokerAnnualReportRepository } from "./brokerAnnualReportRepository";
import { getStandaloneClientDb } from "../clientDb/standaloneClientDb";

async function getRepository(): Promise<BrokerAnnualReportRepository> {
  const db = await getStandaloneClientDb();
  return createClientBrokerAnnualReportRepository(db);
}

export const brokerAnnualReportRepository: BrokerAnnualReportRepository = {
  async findByTaxYearId(taxYearId) {
    const repository = await getRepository();
    return repository.findByTaxYearId(taxYearId);
  },

  async upsert(input) {
    const repository = await getRepository();
    return repository.upsert(input);
  },

  async delete(id) {
    const repository = await getRepository();
    return repository.delete(id);
  },

  async upsertMany(inputs) {
    const repository = await getRepository();
    return repository.upsertMany(inputs);
  },
};
