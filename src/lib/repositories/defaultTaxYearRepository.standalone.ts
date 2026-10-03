// スタンドアロン版ビルド用の`@/lib/repositories/defaultTaxYearRepository`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ5-1-3b)。
//
// 当初は`createClientTaxYearRepository`(wa-sqlite実装。`./taxYearRepository.ts`)に
// `../clientDb/sqlite.ts`の`openClientDb`で開いた`ClientDb`を渡す実装を試みたが、
// `openClientDb`は`node:fs`の`readFileSync`で読み込んだバイト列を
// `createRequire(import.meta.url)`経由でwa-sqliteのWASMローダーに渡すNode専用実装
// (フェーズ0-2のPoCがVitest(Node)環境で動かす前提で書いたもの)で、実際に
// `npm run build:standalone`(`BUILD_TARGET=standalone`でのTurbopackビルド)に
// 通したところ`wa-sqlite/dist/wa-sqlite.wasm_.loader.mjs`の静的解析に失敗し
// (`Module not found: Can't resolve 'a'`。Node専用コードをブラウザ向けバンドルに
// 含めようとして生じるエラー)、ビルドが壊れることが判明した。これはこのファイル
// (`defaultTaxYearRepository`経由で17ファイルから参照される)が、`openClientDb`を
// 実際にNext.jsのビルド(Vitestでの直接呼び出しだけでなく)に初めて引き込む
// モジュールだったために表面化した。
//
// そのため、ブラウザ向け(OPFSベース)の`openClientDb`実装が別途用意されるまでの間
// (README「現在の最優先事項」フェーズ5-1-3bの残課題)、このファイルは
// `createClientTaxYearRepository`を実際には呼ばず、各メソッド呼び出し時に
// 分かりやすいエラーを投げるだけのプレースホルダーとする。本ステップの目的は
// ビルドターゲットに応じて実装を切り替える「機構」(resolveAlias +
// tsconfig.standalone.jsonのpaths)自体を確立することであり、クライアントDBの
// 実動作確認はブラウザ向け`openClientDb`が用意された後のステップで行う。
import type { TaxYearRepository } from "./taxYearRepository";

function notImplemented(): never {
  throw new Error(
    "スタンドアロン版のTaxYearRepositoryクライアント実装は未結線です" +
      "(ブラウザ向けOPFSベースのopenClientDb実装待ち。README「現在の最優先事項」" +
      "フェーズ5-1-3bの残課題を参照)。",
  );
}

export const taxYearRepository: TaxYearRepository = {
  async getOrCreateTaxYear() {
    notImplemented();
  },

  async findByYear() {
    notImplemented();
  },

  async listTaxYears() {
    notImplemented();
  },

  async updateCryptoCostMethod() {
    notImplemented();
  },
};
