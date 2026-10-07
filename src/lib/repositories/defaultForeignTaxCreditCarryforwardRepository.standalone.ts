// スタンドアロン版ビルド用の
// `@/lib/repositories/defaultForeignTaxCreditCarryforwardRepository`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d-16)。
//
// `defaultCasualtyLossCarryforwardRepository.standalone.ts`と同じ理由(ブラウザ向け
// OPFSベースの`openClientDb`実装がまだ無く、Node専用の現行`openClientDb`をそのまま
// 結線するとビルドが壊れる。README「現在の最優先事項」フェーズ5-1-3bの残課題を参照)
// により、`createClientForeignTaxCreditCarryforwardRepository`を実際には呼ばず、
// 各メソッド呼び出し時に分かりやすいエラーを投げるだけのプレースホルダーとする。
import type { ForeignTaxCreditCarryforwardRepository } from "./foreignTaxCreditCarryforwardRepository";

function notImplemented(): never {
  throw new Error(
    "スタンドアロン版のForeignTaxCreditCarryforwardRepositoryクライアント実装は" +
      "未結線です(ブラウザ向けOPFSベースのopenClientDb実装待ち。README" +
      "「現在の最優先事項」フェーズ5-1-3bの残課題を参照)。",
  );
}

export const foreignTaxCreditCarryforwardRepository: ForeignTaxCreditCarryforwardRepository = {
  async findByTaxYearId() {
    notImplemented();
  },

  async upsert() {
    notImplemented();
  },

  async delete() {
    notImplemented();
  },

  async createMany() {
    notImplemented();
  },
};
