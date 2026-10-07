// スタンドアロン版ビルド用の
// `@/lib/repositories/defaultForeignTaxCreditSpareLimitCarryforwardRepository`差し替え
// 実装(next.config.tsのresolveAlias経由。フェーズ5-1-3d-16)。
//
// `defaultForeignTaxCreditCarryforwardRepository.standalone.ts`と同じ理由(ブラウザ向け
// OPFSベースの`openClientDb`実装がまだ無く、Node専用の現行`openClientDb`をそのまま
// 結線するとビルドが壊れる。README「現在の最優先事項」フェーズ5-1-3bの残課題を参照)
// により、`createClientForeignTaxCreditSpareLimitCarryforwardRepository`を実際には
// 呼ばず、各メソッド呼び出し時に分かりやすいエラーを投げるだけのプレースホルダーとする。
import type { ForeignTaxCreditSpareLimitCarryforwardRepository } from "./foreignTaxCreditSpareLimitCarryforwardRepository";

function notImplemented(): never {
  throw new Error(
    "スタンドアロン版のForeignTaxCreditSpareLimitCarryforwardRepositoryクライアント" +
      "実装は未結線です(ブラウザ向けOPFSベースのopenClientDb実装待ち。README" +
      "「現在の最優先事項」フェーズ5-1-3bの残課題を参照)。",
  );
}

export const foreignTaxCreditSpareLimitCarryforwardRepository: ForeignTaxCreditSpareLimitCarryforwardRepository =
  {
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
