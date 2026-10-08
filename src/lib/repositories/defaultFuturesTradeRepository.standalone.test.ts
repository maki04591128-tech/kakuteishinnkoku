/**
 * フェーズ5-3-3: `@/lib/repositories/defaultFuturesTradeRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultFuturesTradeRepository.standalone.ts`)が、`../clientDb/
 * standaloneClientDb.ts`経由で取得した`ClientDb`を
 * `createClientFuturesTradeRepository`に正しく結線していることを
 * 検証する(`createClientFuturesTradeRepository`自体の挙動は
 * `futuresTradeRepository.test.ts`で別途検証済みのため、ここでは
 * 委譲先の`ClientDb`が共有・再利用されていることを中心に確認する。テスト構成は
 * `defaultTaxYearRepository.standalone.test.ts`(5-3-2)と同じ)。
 *
 * `../clientDb/standaloneClientDb`は内部で`new Worker(...)`
 * (`sqlite.browser.ts`)を使うため、このファイルではその下位層をモック化し、
 * Node/Vitest環境でも実行できるようにする。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

const { openClientDbMock, applyClientDbSchemaMock, fakeDb } = vi.hoisted(() => {
  const tradeRow: Record<string, SqlValue> = {
    id: 1,
    tax_year_id: 1,
    settled_at: "2025-01-01T00:00:00.000Z",
    symbol: "日経225mini",
    realized_pnl_jpy: "10000",
    fee_jpy: "100",
    swap_jpy: "0",
    broker: "SBI証券",
    memo: null,
    source: "manual",
    import_batch_id: null,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  };
  const all = vi.fn(async (sql: string): Promise<Record<string, SqlValue>[]> => {
    if (sql.includes("last_insert_rowid")) {
      return [{ id: 1 }];
    }
    return [tradeRow];
  });
  const fakeDb: ClientDb = {
    run: vi.fn(async () => {}),
    all,
    close: vi.fn(async () => {}),
  };
  return {
    openClientDbMock: vi.fn(async (): Promise<ClientDb> => fakeDb),
    applyClientDbSchemaMock: vi.fn(async () => {}),
    fakeDb,
  };
});

vi.mock("../clientDb/sqlite.browser", () => ({
  openClientDb: openClientDbMock,
}));
vi.mock("../clientDb/schema", () => ({
  applyClientDbSchema: applyClientDbSchemaMock,
}));

describe("defaultFuturesTradeRepository (standalone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("共有のClientDb接続を1回だけ開き、全メソッドで再利用する", async () => {
    const { futuresTradeRepository } = await import(
      "./defaultFuturesTradeRepository.standalone"
    );

    await futuresTradeRepository.findByTaxYearId(1);
    await futuresTradeRepository.create({
      taxYearId: 1,
      settledAt: new Date("2025-01-01T00:00:00.000Z"),
      symbol: "日経225mini",
      realizedPnlJpy: "10000",
      feeJpy: "100",
      swapJpy: "0",
      broker: "SBI証券",
    });
    await futuresTradeRepository.delete(1);
    await futuresTradeRepository.importCsvBatch({
      taxYearId: 1,
      sourceType: "sbi",
      fileName: "futures.csv",
      rows: [
        {
          settledAt: new Date("2025-01-01T00:00:00.000Z"),
          symbol: "日経225mini",
          realizedPnlJpy: "10000",
          feeJpy: "100",
          swapJpy: "0",
          broker: "SBI証券",
          source: "sbi",
        },
      ],
    });

    expect(openClientDbMock).toHaveBeenCalledTimes(1);
    expect(openClientDbMock).toHaveBeenCalledWith("kakuteishinnkoku.db");
    expect(applyClientDbSchemaMock).toHaveBeenCalledTimes(1);
    expect(applyClientDbSchemaMock).toHaveBeenCalledWith(fakeDb);
  });

  it("createは共有ClientDbに対してSQLを発行する", async () => {
    const { futuresTradeRepository } = await import(
      "./defaultFuturesTradeRepository.standalone"
    );

    await futuresTradeRepository.create({
      taxYearId: 1,
      settledAt: new Date("2025-01-01T00:00:00.000Z"),
      symbol: "日経225mini",
      realizedPnlJpy: "10000",
      feeJpy: "100",
      swapJpy: "0",
      broker: "SBI証券",
    });

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO futures_trade"),
      expect.arrayContaining([1, "日経225mini", "10000", "100", "0"]),
    );
  });

  it("deleteは共有ClientDbに対してSQLを発行する", async () => {
    const { futuresTradeRepository } = await import(
      "./defaultFuturesTradeRepository.standalone"
    );

    await futuresTradeRepository.delete(1);

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM futures_trade"),
      [1],
    );
  });

  it("importCsvBatchは共有ClientDbに対してSQLを発行する", async () => {
    const { futuresTradeRepository } = await import(
      "./defaultFuturesTradeRepository.standalone"
    );

    await futuresTradeRepository.importCsvBatch({
      taxYearId: 1,
      sourceType: "sbi",
      fileName: "futures.csv",
      rows: [
        {
          settledAt: new Date("2025-01-01T00:00:00.000Z"),
          symbol: "日経225mini",
          realizedPnlJpy: "10000",
          feeJpy: "100",
          swapJpy: "0",
          broker: "SBI証券",
          source: "sbi",
        },
      ],
    });

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO import_batch"),
      expect.arrayContaining([1, "sbi", "futures.csv"]),
    );
    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO futures_trade"),
      expect.arrayContaining(["日経225mini", "10000", "100", "0", "SBI証券", "sbi"]),
    );
  });
});
