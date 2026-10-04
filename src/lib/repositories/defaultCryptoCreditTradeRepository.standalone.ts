// スタンドアロン版ビルド用の
// `@/lib/repositories/defaultCryptoCreditTradeRepository`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3b)。
//
// `defaultCryptoMarginTradeRepository.standalone.ts`と同じ理由(ブラウザ向け
// OPFSベースの`openClientDb`実装がまだ無く、Node専用の現行`openClientDb`をそのまま
// 結線するとビルドが壊れる。README「現在の最優先事項」フェーズ5-1-3bの残課題を参照)
// により、`createClientCryptoCreditTradeRepository`を実際には呼ばず、各メソッド
// 呼び出し時に分かりやすいエラーを投げるだけのプレースホルダーとする。
import type { CryptoCreditTradeRepository } from "./cryptoCreditTradeRepository";

function notImplemented(): never {
  throw new Error(
    "スタンドアロン版のCryptoCreditTradeRepositoryクライアント実装は" +
      "未結線です(ブラウザ向けOPFSベースのopenClientDb実装待ち。README「現在の最優先事項」" +
      "フェーズ5-1-3bの残課題を参照)。",
  );
}

export const cryptoCreditTradeRepository: CryptoCreditTradeRepository = {
  async findByTaxYearId() {
    notImplemented();
  },

  async create() {
    notImplemented();
  },

  async delete() {
    notImplemented();
  },
};
