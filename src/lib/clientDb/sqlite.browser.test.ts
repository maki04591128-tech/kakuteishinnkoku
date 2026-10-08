import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openClientDb } from "./sqlite.browser";
import type { ClientDbWorkerRequest, ClientDbWorkerResponse } from "./workerProtocol";

/**
 * `sqlite.browser.ts`はWeb Worker(`sqlite.worker.ts`)へのpostMessageによる
 * リクエスト/レスポンス往復のみを担うプロキシのため、実際のOPFS・wa-sqlite
 * 実行(Worker側の責務)はこのテストの対象外。`Worker`グローバルをモック化し、
 * リクエストID管理・エラー伝播・close時の挙動のみを検証する。
 */
class FakeWorker {
  static instances: FakeWorker[] = [];
  private messageListeners: ((event: MessageEvent<ClientDbWorkerResponse>) => void)[] = [];
  private errorListeners: ((event: ErrorEvent) => void)[] = [];
  readonly posted: ClientDbWorkerRequest[] = [];
  terminated = false;

  constructor() {
    FakeWorker.instances.push(this);
  }

  addEventListener(type: "message" | "error", listener: (event: unknown) => void): void {
    if (type === "message") {
      this.messageListeners.push(listener as (event: MessageEvent<ClientDbWorkerResponse>) => void);
    } else {
      this.errorListeners.push(listener as (event: ErrorEvent) => void);
    }
  }

  postMessage(request: ClientDbWorkerRequest): void {
    this.posted.push(request);
  }

  terminate(): void {
    this.terminated = true;
  }

  respond(response: ClientDbWorkerResponse): void {
    for (const listener of this.messageListeners) {
      listener({ data: response } as MessageEvent<ClientDbWorkerResponse>);
    }
  }

  emitError(message: string): void {
    for (const listener of this.errorListeners) {
      listener({ message } as ErrorEvent);
    }
  }
}

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker as unknown as typeof Worker);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("openClientDb(sqlite.browser.ts、Workerをモック化)", () => {
  it("open時にWorkerへopenリクエストを送り、ok応答でDbを返す", async () => {
    const dbPromise = openClientDb("test.db");
    const worker = FakeWorker.instances[0];
    expect(worker.posted).toHaveLength(1);
    expect(worker.posted[0]).toMatchObject({ type: "open", name: "test.db" });

    worker.respond({ id: worker.posted[0].id, ok: true });
    await expect(dbPromise).resolves.toBeDefined();
  });

  it("run/allはリクエストごとに一意なIDを使い、allはresultをそのまま返す", async () => {
    const dbPromise = openClientDb("test.db");
    const worker = FakeWorker.instances[0];
    worker.respond({ id: worker.posted[0].id, ok: true });
    const db = await dbPromise;

    const allPromise = db.all("SELECT 1");
    expect(worker.posted).toHaveLength(2);
    const allRequest = worker.posted[1];
    expect(allRequest.id).not.toBe(worker.posted[0].id);
    worker.respond({ id: allRequest.id, ok: true, result: [{ a: 1 }] });
    await expect(allPromise).resolves.toEqual([{ a: 1 }]);

    const runPromise = db.run("INSERT INTO t VALUES (?)", [1]);
    const runRequest = worker.posted[2];
    expect(runRequest.type).toBe("run");
    worker.respond({ id: runRequest.id, ok: true });
    await expect(runPromise).resolves.toBeUndefined();
  });

  it("Workerがok:falseを返すとそのエラーメッセージで拒否する", async () => {
    const dbPromise = openClientDb("test.db");
    const worker = FakeWorker.instances[0];
    worker.respond({ id: worker.posted[0].id, ok: true });
    const db = await dbPromise;

    const allPromise = db.all("SELECT 1");
    worker.respond({ id: worker.posted[1].id, ok: false, error: "構文エラー" });
    await expect(allPromise).rejects.toThrow("構文エラー");
  });

  it("Workerのerrorイベント発生時は保留中の全リクエストを拒否する", async () => {
    const dbPromise = openClientDb("test.db");
    const worker = FakeWorker.instances[0];
    worker.respond({ id: worker.posted[0].id, ok: true });
    const db = await dbPromise;

    const allPromise = db.all("SELECT 1");
    const runPromise = db.run("SELECT 1");
    worker.emitError("クラッシュ");
    await expect(allPromise).rejects.toThrow("クラッシュ");
    await expect(runPromise).rejects.toThrow("クラッシュ");
  });

  it("closeはcloseリクエストのok応答を待ってからWorkerをterminateする", async () => {
    const dbPromise = openClientDb("test.db");
    const worker = FakeWorker.instances[0];
    worker.respond({ id: worker.posted[0].id, ok: true });
    const db = await dbPromise;

    const closePromise = db.close();
    const closeRequest = worker.posted[1];
    expect(closeRequest.type).toBe("close");
    expect(worker.terminated).toBe(false);

    worker.respond({ id: closeRequest.id, ok: true });
    await closePromise;
    expect(worker.terminated).toBe(true);
  });
});
