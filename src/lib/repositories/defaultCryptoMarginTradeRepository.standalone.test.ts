/**
 * フェーズ5-3-3: `@/lib/repositories/defaultCryptoMarginTradeRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultCryptoMarginTradeRepository.standalone.ts`)が、`../clientDb/
 * standaloneClientDb.ts`経由で取得した`ClientDb`を
 * `createClientCryptoMarginTradeRepository`に正しく結線していることを
 * 検証する(`createClientCryptoMarginTradeRepository`自体の挙動は
 * `cryptoMarginTradeRepository.test.ts`で別途検証済みのため、ここでは
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
    symbol: "BTC",
    realized_pnl_jpy: "10000",
    fee_jpy: "100",
    swap_jpy: "0",
    exchange: "bitFlyer",
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

describe("defaultCryptoMarginTradeRepository (standalone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("共有のClientDb接続を1回だけ開き、全メソッドで再利用する", async () => {
    const { cryptoMarginTradeRepository } = await import(
      "./defaultCryptoMarginTradeRepository.standalone"
    );

    await cryptoMarginTradeRepository.findByTaxYearId(1);
    await cryptoMarginTradeRepository.create({
      taxYearId: 1,
      settledAt: new Date("2025-01-01T00:00:00.000Z"),
      symbol: "BTC",
      realizedPnlJpy: "10000",
      feeJpy: "100",
      swapJpy: "0",
      exchange: "bitFlyer",
    });
    await cryptoMarginTradeRepository.delete(1);
    await cryptoMarginTradeRepository.importCsvBatch({
      taxYearId: 1,
      sourceType: "bitflyer",
      fileName: "margin.csv",
      rows: [
        {
          settledAt: new Date("2025-01-01T00:00:00.000Z"),
          symbol: "BTC",
          realizedPnlJpy: "10000",
          feeJpy: "100",
          swapJpy: "0",
          exchange: "bitFlyer",
          source: "bitflyer",
        },
      ],
    });

    expect(openClientDbMock).toHaveBeenCalledTimes(1);
    expect(openClientDbMock).toHaveBeenCalledWith("kakuteishinnkoku.db");
    expect(applyClientDbSchemaMock).toHaveBeenCalledTimes(1);
    expect(applyClientDbSchemaMock).toHaveBeenCalledWith(fakeDb);
  });

  it("createは共有ClientDbに対してSQLを発行する", async () => {
    const { cryptoMarginTradeRepository } = await import(
      "./defaultCryptoMarginTradeRepository.standalone"
    );

    await cryptoMarginTradeRepository.create({
      taxYearId: 1,
      settledAt: new Date("2025-01-01T00:00:00.000Z"),
      symbol: "BTC",
      realizedPnlJpy: "10000",
      feeJpy: "100",
      swapJpy: "0",
      exchange: "bitFlyer",
    });

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO crypto_margin_trade"),
      expect.arrayContaining([1, "BTC", "10000", "100", "0"]),
    );
  });

  it("deleteは共有ClientDbに対してSQLを発行する", async () => {
    const { cryptoMarginTradeRepository } = await import(
      "./defaultCryptoMarginTradeRepository.standalone"
    );

    await cryptoMarginTradeRepository.delete(1);

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM crypto_margin_trade"),
      [1],
    );
  });

  it("importCsvBatchは共有ClientDbに対してSQLを発行する", async () => {
    const { cryptoMarginTradeRepository } = await import(
      "./defaultCryptoMarginTradeRepository.standalone"
    );

    await cryptoMarginTradeRepository.importCsvBatch({
      taxYearId: 1,
      sourceType: "bitflyer",
      fileName: "margin.csv",
      rows: [
        {
          settledAt: new Date("2025-01-01T00:00:00.000Z"),
          symbol: "BTC",
          realizedPnlJpy: "10000",
          feeJpy: "100",
          swapJpy: "0",
          exchange: "bitFlyer",
          source: "bitflyer",
        },
      ],
    });

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO import_batch"),
      expect.arrayContaining([1, "bitflyer", "margin.csv"]),
    );
    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO crypto_margin_trade"),
      expect.arrayContaining(["BTC", "10000", "100", "0", "bitFlyer", "bitflyer"]),
    );
  });
});
