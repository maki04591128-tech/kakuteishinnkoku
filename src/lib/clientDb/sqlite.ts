/**
 * スタンドアロン(Android)版のクライアントサイドDB PoC(フェーズ0-2)。
 *
 * README「スタンドアロン(Android)版への移行」フェーズ0で選定したwa-sqliteを、
 * このセッション(Node/Vitest環境)で動かすための最小ラッパー。永続化は
 * wa-sqlite付属のMemoryVFS(プロセス内メモリのみ、ページリロードで消える)を使う。
 * 実機(Capacitor WebView)向けのOPFS永続化・WASMのバンドル方法はフェーズ2で検討する。
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import SQLiteESMFactory from "wa-sqlite/dist/wa-sqlite.mjs";
import * as SQLite from "wa-sqlite";
import { MemoryVFS } from "wa-sqlite/src/examples/MemoryVFS.js";

const require = createRequire(import.meta.url);

type Sqlite3Api = ReturnType<typeof SQLite.Factory>;

let sqlite3Promise: Promise<Sqlite3Api> | undefined;

function loadSqlite3(): Promise<Sqlite3Api> {
  if (!sqlite3Promise) {
    sqlite3Promise = (async () => {
      const wasmBinary = readFileSync(
        require.resolve("wa-sqlite/dist/wa-sqlite.wasm"),
      );
      const wasmModule = await SQLiteESMFactory({ wasmBinary });
      const sqlite3 = SQLite.Factory(wasmModule);
      // MemoryVFS.js(wa-sqlite付属のJS例)はJSDocの型注釈がsqlite-api.jsの
      // SQLiteVFS型定義とTS上厳密に一致しないため、ここではanyで橋渡しする。
      sqlite3.vfs_register(
        new MemoryVFS() as unknown as Parameters<
          typeof sqlite3.vfs_register
        >[0],
        false,
      );
      return sqlite3;
    })();
  }
  return sqlite3Promise;
}

export type SqlValue = number | string | Uint8Array | bigint | null;

export interface ClientDb {
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all(sql: string, params?: SqlValue[]): Promise<Record<string, SqlValue>[]>;
  close(): Promise<void>;
}

/** 名前(ファイル名相当)ごとに独立したメモリ内DBを開く。 */
export async function openClientDb(name: string): Promise<ClientDb> {
  const sqlite3 = await loadSqlite3();
  const db = await sqlite3.open_v2(name, undefined, "memory");

  return {
    async run(sql, params) {
      await sqlite3.execWithParams(db, sql, params);
    },
    async all(sql, params) {
      const { rows, columns } = await sqlite3.execWithParams(db, sql, params);
      return rows.map((row) =>
        Object.fromEntries(columns.map((column, i) => [column, row[i]])),
      );
    },
    async close() {
      await sqlite3.close(db);
    },
  };
}
