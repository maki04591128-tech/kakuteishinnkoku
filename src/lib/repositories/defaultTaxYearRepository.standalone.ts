/**
 * スタンドアロン版ビルド用の`@/lib/repositories/defaultTaxYearRepository`
 * 差し替え実装(`next.config.ts`のresolveAlias経由。フェーズ5-1-3b)。
 *
 * クライアントサイドDB(`src/lib/clientDb/`)を初回アクセス時に一度だけ開いて
 * スキーマを適用し、以後はそのインスタンスを使い回す。
 *
 * 注意: 現状`openClientDb`(`src/lib/clientDb/sqlite.ts`)は
 * `node:fs`/`node:module`を使うNode専用実装で、永続化もwa-sqlite付属の
 * `MemoryVFS`(プロセス内メモリのみ)のままであり、実際のブラウザ
 * (Capacitor WebView)では動作しない。本ファイルはビルドターゲットに応じて
 * 既定のリポジトリ実装を切り替える「機構」自体を確立するためのもので、
 * 実機で実際に使うにはOPFSベースのブラウザ向け`openClientDb`実装が別途
 * 必要(README「現在の最優先事項」フェーズ5-1-3b参照)。
 */
import { applyClientDbSchema } from "../clientDb/schema";
import { openClientDb } from "../clientDb/sqlite";
import { createClientTaxYearRepository, type TaxYearRepository } from "./taxYearRepository";

const CLIENT_DB_NAME = "kakuteishinnkoku.db";

let repositoryPromise: Promise<TaxYearRepository> | undefined;

function getRepository(): Promise<TaxYearRepository> {
  if (!repositoryPromise) {
    repositoryPromise = (async () => {
      const db = await openClientDb(CLIENT_DB_NAME);
      await applyClientDbSchema(db);
      return createClientTaxYearRepository(db);
    })();
  }
  return repositoryPromise;
}

export const defaultTaxYearRepository: TaxYearRepository = {
  async getOrCreateTaxYear(year) {
    return (await getRepository()).getOrCreateTaxYear(year);
  },

  async findByYear(year) {
    return (await getRepository()).findByYear(year);
  },

  async listTaxYears() {
    return (await getRepository()).listTaxYears();
  },

  async updateCryptoCostMethod(id, cryptoCostMethod) {
    return (await getRepository()).updateCryptoCostMethod(id, cryptoCostMethod);
  },
};
