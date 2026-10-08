// スタンドアロン版ビルド用の
// `@/lib/repositories/defaultEmploymentIncomeRecordRepository`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3b)。
//
// フェーズ5-1-3bの時点ではブラウザ向け(OPFSベース)の`openClientDb`実装が
// 無かったため、各メソッド呼び出し時にエラーを投げるだけのプレースホルダーに
// していた。フェーズ5-3でブラウザ向け実装(`../clientDb/sqlite.browser.ts`)が
// 用意され、5-3-2で`TaxYearRepository`を結線したパターンを、本ステップ(5-3-3)で
// このモデルにも適用する。`getStandaloneClientDb()`
// (`../clientDb/standaloneClientDb.ts`)がアプリ全体で共有する`ClientDb`接続を
// 遅延オープンし、`createClientEmploymentIncomeRecordRepository`
// (wa-sqlite実装。`./employmentIncomeRecordRepository.ts`)に渡す。
import { createClientEmploymentIncomeRecordRepository } from "./employmentIncomeRecordRepository";
import type { EmploymentIncomeRecordRepository } from "./employmentIncomeRecordRepository";
import { getStandaloneClientDb } from "../clientDb/standaloneClientDb";

async function getRepository(): Promise<EmploymentIncomeRecordRepository> {
  const db = await getStandaloneClientDb();
  return createClientEmploymentIncomeRecordRepository(db);
}

export const employmentIncomeRecordRepository: EmploymentIncomeRecordRepository = {
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
