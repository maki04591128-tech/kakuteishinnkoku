/**
 * フェーズ5-3-3: `@/lib/repositories/defaultCryptoTradeRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultCryptoTradeRepository.standalone.ts`)が、`../clientDb/
 * standaloneClientDb.ts`経由で取得した`ClientDb`を
 * `createClientCryptoTradeRepository`に正しく結線していることを
 * 検証する(`createClientCryptoTradeRepository`自体の挙動は
 * `cryptoTradeRepository.test.ts`で別途検証済みのため、ここでは
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
  const row: Record<string, SqlValue> = {
    id: 1,
    tax_year_id: 1,
    traded_at: "2025-01-01T00:00:00.000Z",
    symbol: "BTC",
    type: "BUY",
    quantity: "1",
    unit_price_jpy: "5000000",
    market_value_unit_price_jpy: null,
    fee_jpy: "100",
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
    return [row];
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

describe("defaultCryptoTradeRepository (standalone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("共有のClientDb接続を1回だけ開き、全メソッドで再利用する", async () => {
    const { cryptoTradeRepository } = await import(
      "./defaultCryptoTradeRepository.standalone"
    );

    await cryptoTradeRepository.findByTaxYearId(1);
    await cryptoTradeRepository.create({
      taxYearId: 1,
      tradedAt: new Date("2025-01-01T00:00:00.000Z"),
      symbol: "BTC",
      type: "BUY",
      quantity: "1",
      unitPriceJpy: "5000000",
      feeJpy: "100",
      exchange: "bitFlyer",
    });
    await cryptoTradeRepository.delete(1);
    await cryptoTradeRepository.importCsvBatch({
      taxYearId: 1,
      sourceType: "bitflyer",
      fileName: "trade.csv",
      rows: [
        {
          tradedAt: new Date("2025-01-01T00:00:00.000Z"),
          symbol: "BTC",
          type: "BUY",
          quantity: "1",
          unitPriceJpy: "5000000",
          feeJpy: "100",
          exchange: "bitFlyer",
          memo: null,
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
    const { cryptoTradeRepository } = await import(
      "./defaultCryptoTradeRepository.standalone"
    );

    await cryptoTradeRepository.create({
      taxYearId: 1,
      tradedAt: new Date("2025-01-01T00:00:00.000Z"),
      symbol: "BTC",
      type: "BUY",
      quantity: "1",
      unitPriceJpy: "5000000",
      feeJpy: "100",
      exchange: "bitFlyer",
    });

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO crypto_trade"),
      expect.arrayContaining([1, "BTC", "BUY", "1", "5000000"]),
    );
  });

  it("deleteは共有ClientDbに対してSQLを発行する", async () => {
    const { cryptoTradeRepository } = await import(
      "./defaultCryptoTradeRepository.standalone"
    );

    await cryptoTradeRepository.delete(1);

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM crypto_trade"),
      [1],
    );
  });

  it("importCsvBatchは共有ClientDbに対してSQLを発行する", async () => {
    const { cryptoTradeRepository } = await import(
      "./defaultCryptoTradeRepository.standalone"
    );

    await cryptoTradeRepository.importCsvBatch({
      taxYearId: 1,
      sourceType: "bitflyer",
      fileName: "trade.csv",
      rows: [
        {
          tradedAt: new Date("2025-01-01T00:00:00.000Z"),
          symbol: "BTC",
          type: "BUY",
          quantity: "1",
          unitPriceJpy: "5000000",
          feeJpy: "100",
          exchange: "bitFlyer",
          memo: null,
          source: "bitflyer",
        },
      ],
    });

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO import_batch"),
      expect.arrayContaining([1, "bitflyer", "trade.csv"]),
    );
    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO crypto_trade"),
      expect.arrayContaining(["BTC", "BUY", "1", "5000000"]),
    );
  });
});
