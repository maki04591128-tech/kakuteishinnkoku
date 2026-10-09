/**
 * フェーズ5-3-3: `@/lib/repositories/defaultStockMarginTradeRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultStockMarginTradeRepository.standalone.ts`)が、`../clientDb/
 * standaloneClientDb.ts`経由で取得した`ClientDb`を
 * `createClientStockMarginTradeRepository`に正しく結線していることを
 * 検証する(`createClientStockMarginTradeRepository`自体の挙動は
 * `stockMarginTradeRepository.test.ts`で別途検証済みのため、ここでは
 * 委譲先の`ClientDb`が共有・再利用されていることを中心に確認する。テスト構成は
 * `defaultInvestmentTradeRepository.standalone.test.ts`(5-3-3)と同じ)。
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
    settled_at: "2026-01-01T00:00:00.000Z",
    symbol: "7203",
    realized_pnl_jpy: "100000",
    fee_jpy: "0",
    interest_adjustment_jpy: "0",
    broker: null,
    memo: null,
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

describe("defaultStockMarginTradeRepository (standalone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("共有のClientDb接続を1回だけ開き、全メソッドで再利用する", async () => {
    const { stockMarginTradeRepository } = await import(
      "./defaultStockMarginTradeRepository.standalone"
    );

    await stockMarginTradeRepository.findByTaxYearId(1);
    await stockMarginTradeRepository.create({
      taxYearId: 1,
      settledAt: new Date("2026-01-01T00:00:00.000Z"),
      symbol: "7203",
      realizedPnlJpy: "100000",
    });
    await stockMarginTradeRepository.delete(1);

    expect(openClientDbMock).toHaveBeenCalledTimes(1);
    expect(openClientDbMock).toHaveBeenCalledWith("kakuteishinnkoku.db");
    expect(applyClientDbSchemaMock).toHaveBeenCalledTimes(1);
    expect(applyClientDbSchemaMock).toHaveBeenCalledWith(fakeDb);
  });

  it("createは共有ClientDbに対してSQLを発行する", async () => {
    const { stockMarginTradeRepository } = await import(
      "./defaultStockMarginTradeRepository.standalone"
    );

    await stockMarginTradeRepository.create({
      taxYearId: 1,
      settledAt: new Date("2026-01-01T00:00:00.000Z"),
      symbol: "7203",
      realizedPnlJpy: "100000",
    });

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO stock_margin_trade"),
      expect.arrayContaining([1, "7203", "100000"]),
    );
  });

  it("deleteは共有ClientDbに対してSQLを発行する", async () => {
    const { stockMarginTradeRepository } = await import(
      "./defaultStockMarginTradeRepository.standalone"
    );

    await stockMarginTradeRepository.delete(1);

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM stock_margin_trade"),
      [1],
    );
  });
});
