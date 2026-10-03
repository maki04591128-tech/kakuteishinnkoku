// スタンドアロン版ビルド用の`@/lib/repositories/defaultTaxYearRepository`差し替え実装
// (next.config.tsのresolveAlias経由)。
//
// フェーズ2で追加した`createClientTaxYearRepository`(wa-sqlite実装)はブラウザ上で
// 開いた`ClientDb`インスタンスを引数に要求するが、ブラウザ(Capacitor WebView)向けの
// OPFSベース`openClientDb`実装(README フェーズ0で決定した本来の永続化方式)がまだ無く、
// アプリ全体でその`ClientDb`インスタンスを共有するための仕組み(シングルトン等)も
// このステップ(5-1-3b)の対象外のため、ここでは未実装であることが分かるように
// エラーを投げる(READMEフェーズ5-1-3bの「残課題」参照)。
import type { TaxYearRepository } from "./taxYearRepository";

function notImplemented(): never {
  throw new Error(
    "createDefaultTaxYearRepository (standalone): ブラウザ向けOPFSベースの" +
      "ClientDb実装・共有の仕組みがまだ無いため未実装です" +
      "(README「現在の最優先事項」フェーズ5-1-3b参照)。",
  );
}

export function createDefaultTaxYearRepository(): TaxYearRepository {
  return {
    getOrCreateTaxYear: notImplemented,
    findByYear: notImplemented,
    listTaxYears: notImplemented,
    updateCryptoCostMethod: notImplemented,
  };
}
