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

const UNSUPPORTED_ENVIRONMENT_MESSAGE =
  "このAndroid端末のWebView(ブラウザ機能)が古く、本アプリの動作に必要な機能" +
  "(Web Worker・OPFS)に対応していません。Google Playストアから" +
  "「Android System WebView」アプリを最新版に更新してください。";

/**
 * `AccessHandlePoolVFS`(OPFS)・Web Workerに依存する`openClientDb`を呼ぶ前の
 * 実行環境チェック(フェーズ6-12)。未対応の古いWebViewでは、対応していない
 * まま`new Worker()`やWorker内の`navigator.storage.getDirectory()`呼び出しで
 * 原因の分かりにくい低レベルなエラー(`Worker is not defined`等)になるため、
 * ここで早期に検出しユーザーに原因と対処(WebView更新)が伝わるメッセージに
 * 変換する。
 */
function assertClientDbEnvironmentSupported(): void {
  const hasWorker = typeof Worker !== "undefined";
  const hasOpfs =
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function";
  if (!hasWorker || !hasOpfs) {
    throw new Error(UNSUPPORTED_ENVIRONMENT_MESSAGE);
  }
}

export async function openClientDb(name: string): Promise<ClientDb> {
  assertClientDbEnvironmentSupported();

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
