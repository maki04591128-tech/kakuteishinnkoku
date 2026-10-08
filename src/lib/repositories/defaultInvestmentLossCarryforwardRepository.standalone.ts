// スタンドアロン版ビルド用の
// `@/lib/repositories/defaultInvestmentLossCarryforwardRepository`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d-17)。
//
// フェーズ5-1-3bの時点ではブラウザ向け(OPFSベース)の`openClientDb`実装が
// 無かったため、各メソッド呼び出し時にエラーを投げるだけのプレースホルダーに
// していた。フェーズ5-3でブラウザ向け実装(`../clientDb/sqlite.browser.ts`)が
// 用意され、5-3-2で`TaxYearRepository`向けに確立したパターンを、本ステップ(5-3-3)で
// このモデルにも適用する。`getStandaloneClientDb()`
// (`../clientDb/standaloneClientDb.ts`)がアプリ全体で共有する`ClientDb`接続を
// 遅延オープンし、`createClientInvestmentLossCarryforwardRepository`
// (wa-sqlite実装。`./investmentLossCarryforwardRepository.ts`)に渡す。
import { createClientInvestmentLossCarryforwardRepository } from "./investmentLossCarryforwardRepository";
import type { InvestmentLossCarryforwardRepository } from "./investmentLossCarryforwardRepository";
import { getStandaloneClientDb } from "../clientDb/standaloneClientDb";

async function getRepository(): Promise<InvestmentLossCarryforwardRepository> {
  const db = await getStandaloneClientDb();
  return createClientInvestmentLossCarryforwardRepository(db);
}

export const investmentLossCarryforwardRepository: InvestmentLossCarryforwardRepository =
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
