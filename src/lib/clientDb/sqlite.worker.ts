/**
 * `sqlite.browser.ts`から起動されるWorker本体(フェーズ5-3)。
 *
 * OPFSの`createSyncAccessHandle()`がWeb Workerコンテキスト限定のため、
 * wa-sqlite(フェーズ0で決定したOPFSベースVFSの`AccessHandlePoolVFS`)の実行は
 * このファイル内に閉じ込め、メインスレッドとはpostMessageのみでやり取りする。
 *
 * **検証状況:** このクラウド開発環境にはOPFS対応ブラウザが無く(Node/Vitest環境
 * のみ)、実際のOPFS永続化・Worker内でのwa-sqlite実行はこのセッションでは検証
 * できない(README フェーズ5-2のAndroid実機ビルドと同様の制約)。SQL実行部分の
 * ロジック自体はフェーズ0-2のNode版PoC(`sqlite.ts`)と同じAPI呼び出し
 * (`execWithParams`/`open_v2`/`close`)を踏襲している。
 */
import SQLiteESMFactory from "wa-sqlite/dist/wa-sqlite.mjs";
import * as SQLite from "wa-sqlite";
import { AccessHandlePoolVFS } from "wa-sqlite/src/examples/AccessHandlePoolVFS.js";
import type { SqlValue } from "./sqlite";
import type { ClientDbWorkerRequest, ClientDbWorkerResponse } from "./workerProtocol";

type Sqlite3Api = ReturnType<typeof SQLite.Factory>;

let sqlite3Promise: Promise<Sqlite3Api> | undefined;

function loadSqlite3(): Promise<Sqlite3Api> {
  if (!sqlite3Promise) {
    sqlite3Promise = (async () => {
      // Node版(sqlite.ts)の`wasmBinary`指定(`node:fs`経由)はブラウザでは使えない
      // ため、wa-sqlite標準のfetchベースのWASMロードに委ねる(オプション省略)。
      const wasmModule = await SQLiteESMFactory();
      return SQLite.Factory(wasmModule);
    })();
  }
  return sqlite3Promise;
}

let db: number | undefined;

async function openDb(name: string): Promise<void> {
  const sqlite3 = await loadSqlite3();
  const vfs = new AccessHandlePoolVFS(name);
  await vfs.isReady;
  sqlite3.vfs_register(vfs as unknown as Parameters<typeof sqlite3.vfs_register>[0], true);
  db = await sqlite3.open_v2(name);
}

async function run(sql: string, params?: SqlValue[]): Promise<Record<string, SqlValue>[]> {
  if (db === undefined) {
    throw new Error("clientDb worker: DBが未初期化です(先にopenリクエストが必要)");
  }
  const sqlite3 = await loadSqlite3();
  const { rows, columns } = await sqlite3.execWithParams(db, sql, params);
  return rows.map((row) => Object.fromEntries(columns.map((column, i) => [column, row[i]])));
}

async function closeDb(): Promise<void> {
  if (db === undefined) return;
  const sqlite3 = await loadSqlite3();
  await sqlite3.close(db);
  db = undefined;
}

async function handleRequest(
  request: ClientDbWorkerRequest,
): Promise<Record<string, SqlValue>[] | undefined> {
  switch (request.type) {
    case "open":
      await openDb(request.name);
      return undefined;
    case "run":
      await run(request.sql, request.params);
      return undefined;
    case "all":
      return run(request.sql, request.params);
    case "close":
      await closeDb();
      return undefined;
  }
}

self.addEventListener("message", (event: MessageEvent<ClientDbWorkerRequest>) => {
  const request = event.data;
  handleRequest(request).then(
    (result) => {
      const response: ClientDbWorkerResponse = { id: request.id, ok: true, result };
      self.postMessage(response);
    },
    (error: unknown) => {
      const response: ClientDbWorkerResponse = {
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
      self.postMessage(response);
    },
  );
});
