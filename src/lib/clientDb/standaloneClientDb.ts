/**
 * スタンドアロン(Android)版の各`defaultXxxRepository.standalone.ts`が共有する
 * `ClientDb`接続(フェーズ5-3-2)。
 *
 * モデルごとに個別の`openClientDb`呼び出しを行うと、`sqlite.browser.ts`の
 * 実装上Workerを都度新規に起動することになり、OPFSベースのVFS
 * (`AccessHandlePoolVFS`)が同じDBファイルに対して複数のWorkerから同時に
 * `createSyncAccessHandle()`しようとして排他ロックに抵触する(1つのOPFS
 * ファイルは同時に1つのアクセスハンドルしか持てない)。そのためアプリ全体で
 * `ClientDb`接続を1つだけ開き、スキーマ適用(`applyClientDbSchema`)まで
 * 済ませた上で全リポジトリに共有する。
 */
import { openClientDb } from "./sqlite.browser";
import { applyClientDbSchema } from "./schema";
import type { ClientDb } from "./sqlite";

const DB_NAME = "kakuteishinnkoku.db";

let dbPromise: Promise<ClientDb> | undefined;

/** アプリ全体で共有する`ClientDb`を遅延オープンする。2回目以降は同じPromiseを返す。 */
export function getStandaloneClientDb(): Promise<ClientDb> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await openClientDb(DB_NAME);
      await applyClientDbSchema(db);
      return db;
    })();
  }
  return dbPromise;
}
