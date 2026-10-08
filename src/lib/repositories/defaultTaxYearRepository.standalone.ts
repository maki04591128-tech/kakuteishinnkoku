// スタンドアロン版ビルド用の`@/lib/repositories/defaultTaxYearRepository`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3b)。
//
// フェーズ5-1-3bの時点ではブラウザ向け(OPFSベース)の`openClientDb`実装が
// 無かったため、各メソッド呼び出し時にエラーを投げるだけのプレースホルダーに
// していた。フェーズ5-3でブラウザ向け実装(`../clientDb/sqlite.browser.ts`)が
// 用意されたため、本ステップ(5-3-2)で実際に結線する。`getStandaloneClientDb()`
// (`../clientDb/standaloneClientDb.ts`)がアプリ全体で共有する`ClientDb`接続を
// 遅延オープンし、`createClientTaxYearRepository`(wa-sqlite実装。
// `./taxYearRepository.ts`)に渡す。
import { createClientTaxYearRepository } from "./taxYearRepository";
import type { TaxYearRepository } from "./taxYearRepository";
import { getStandaloneClientDb } from "../clientDb/standaloneClientDb";

async function getRepository(): Promise<TaxYearRepository> {
  const db = await getStandaloneClientDb();
  return createClientTaxYearRepository(db);
}

export const taxYearRepository: TaxYearRepository = {
  async getOrCreateTaxYear(year) {
    const repository = await getRepository();
    return repository.getOrCreateTaxYear(year);
  },

  async findByYear(year) {
    const repository = await getRepository();
    return repository.findByYear(year);
  },

  async listTaxYears() {
    const repository = await getRepository();
    return repository.listTaxYears();
  },

  async updateCryptoCostMethod(id, cryptoCostMethod) {
    const repository = await getRepository();
    return repository.updateCryptoCostMethod(id, cryptoCostMethod);
  },
};
