/**
 * スタンドアロン版`openClientDb`のブラウザ実装(`sqlite.browser.ts`)と、
 * 実際にwa-sqliteを実行するWorker側(`sqlite.worker.ts`)の間でpostMessageを
 * 通じてやり取りするメッセージ形式(フェーズ5-3)。
 *
 * OPFSの`createSyncAccessHandle()`はWeb Workerコンテキスト限定という制約がある
 * (フェーズ0の調査結果。README参照)ため、メインスレッド側の`ClientDb`実装は
 * SQLite自体を実行せず、Workerへリクエストを送って結果を待つプロキシとする。
 */
import type { SqlValue } from "./sqlite";

export type ClientDbWorkerRequest =
  | { id: number; type: "open"; name: string }
  | { id: number; type: "run"; sql: string; params?: SqlValue[] }
  | { id: number; type: "all"; sql: string; params?: SqlValue[] }
  | { id: number; type: "close" };

export type ClientDbWorkerResponse =
  | { id: number; ok: true; result?: Record<string, SqlValue>[] }
  | { id: number; ok: false; error: string };
