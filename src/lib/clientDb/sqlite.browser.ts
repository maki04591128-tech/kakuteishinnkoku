/**
 * スタンドアロン(Android/Capacitor WebView)版の`openClientDb`実装(フェーズ5-3)。
 *
 * フェーズ0の決定通りOPFSベースのVFS(`AccessHandlePoolVFS`)で永続化するが、
 * `createSyncAccessHandle()`がWeb Workerコンテキスト限定のため、実際のwa-sqlite
 * 実行は`sqlite.worker.ts`内で行う。このファイルはメインスレッド側で
 * `ClientDb`インターフェースを実装し、各メソッド呼び出しをWorkerへの
 * postMessageリクエストに変換してリクエストIDで結果を待ち合わせるプロキシ。
 *
 * **検証状況:** このクラウド開発環境にはOPFS対応ブラウザが無く(Node/Vitest環境
 * のみ)、実際のWorker起動・OPFS永続化はこのセッションでは検証できない
 * (README フェーズ5-2のAndroid実機ビルドと同様の制約)。本ファイルの
 * リクエスト/レスポンス往復処理(IDの一意性・エラー伝播・close時のWorker終了)
 * 自体は`sqlite.browser.test.ts`でWorkerをモック化して検証済み。
 */
import type { ClientDb, SqlValue } from "./sqlite";
import type { ClientDbWorkerRequest, ClientDbWorkerResponse } from "./workerProtocol";

let nextRequestId = 1;

export async function openClientDb(name: string): Promise<ClientDb> {
  const worker = new Worker(new URL("./sqlite.worker.ts", import.meta.url), {
    type: "module",
  });

  const pending = new Map<
    number,
    {
      resolve: (result: Record<string, SqlValue>[]) => void;
      reject: (error: Error) => void;
    }
  >();

  worker.addEventListener("message", (event: MessageEvent<ClientDbWorkerResponse>) => {
    const response = event.data;
    const callbacks = pending.get(response.id);
    if (!callbacks) return;
    pending.delete(response.id);
    if (response.ok) {
      callbacks.resolve(response.result ?? []);
    } else {
      callbacks.reject(new Error(response.error));
    }
  });

  worker.addEventListener("error", (event: ErrorEvent) => {
    const error = new Error(event.message || "clientDb worker error");
    for (const [id, callbacks] of pending) {
      pending.delete(id);
      callbacks.reject(error);
    }
  });

  function send(request: ClientDbWorkerRequest): Promise<Record<string, SqlValue>[]> {
    return new Promise((resolve, reject) => {
      pending.set(request.id, { resolve, reject });
      worker.postMessage(request);
    });
  }

  await send({ id: nextRequestId++, type: "open", name });

  return {
    async run(sql, params) {
      await send({ id: nextRequestId++, type: "run", sql, params });
    },
    async all(sql, params) {
      return send({ id: nextRequestId++, type: "all", sql, params });
    },
    async close() {
      await send({ id: nextRequestId++, type: "close" });
      worker.terminate();
    },
  };
}
