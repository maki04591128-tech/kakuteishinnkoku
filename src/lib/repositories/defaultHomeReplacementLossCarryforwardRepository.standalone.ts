// スタンドアロン版ビルド用の
// `@/lib/repositories/defaultHomeReplacementLossCarryforwardRepository`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3d-18)。
//
// `defaultTaxYearRepository.standalone.ts`と同じ理由(ブラウザ向けOPFSベースの
// `openClientDb`実装がまだ無く、Node専用の現行`openClientDb`をそのまま結線すると
// ビルドが壊れる。README「現在の最優先事項」フェーズ5-1-3bの残課題を参照)により、
// `createClientHomeReplacementLossCarryforwardRepository`を実際には呼ばず、各メソッド
// 呼び出し時に分かりやすいエラーを投げるだけのプレースホルダーとする。
import type { HomeReplacementLossCarryforwardRepository } from "./homeReplacementLossCarryforwardRepository";

function notImplemented(): never {
  throw new Error(
    "スタンドアロン版のHomeReplacementLossCarryforwardRepositoryクライアント実装は" +
      "未結線です(ブラウザ向けOPFSベースのopenClientDb実装待ち。README" +
      "「現在の最優先事項」フェーズ5-1-3bの残課題を参照)。",
  );
}

export const homeReplacementLossCarryforwardRepository: HomeReplacementLossCarryforwardRepository =
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
