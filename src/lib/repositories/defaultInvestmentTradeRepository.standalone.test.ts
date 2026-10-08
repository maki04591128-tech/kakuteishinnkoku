/**
 * フェーズ5-3-3: `@/lib/repositories/defaultInvestmentTradeRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultInvestmentTradeRepository.standalone.ts`)が、`../clientDb/
 * standaloneClientDb.ts`経由で取得した`ClientDb`を
 * `createClientInvestmentTradeRepository`に正しく結線していることを
 * 検証する(`createClientInvestmentTradeRepository`自体の挙動は
 * `investmentTradeRepository.test.ts`で別途検証済みのため、ここでは
 * 委譲先の`ClientDb`が共有・再利用されていることを中心に確認する。テスト構成は
 * `defaultCryptoCreditTradeRepository.standalone.test.ts`(5-3-3)と同じ)。
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
    traded_at: "2026-01-01T00:00:00.000Z",
    symbol: "7203",
    name: null,
    asset_type: "STOCK",
    is_reit: 0,
    mutual_fund_high_foreign_ratio: 0,
    mutual_fund_very_high_foreign_ratio: 0,
    is_listed: 1,
    type: "BUY",
    quantity: "100",
    unit_price_jpy: "2500",
    fee_jpy: "0",
    account_type: "SPECIFIC_WITHHOLDING",
    is_nisa: 0,
    nisa_type: null,
    is_foreign: 0,
    foreign_tax_withheld_jpy: "0",
    distribution_adjusted_foreign_tax_jpy: "0",
    broker: null,
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

describe("defaultInvestmentTradeRepository (standalone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("共有のClientDb接続を1回だけ開き、全メソッドで再利用する", async () => {
    const { investmentTradeRepository } = await import(
      "./defaultInvestmentTradeRepository.standalone"
    );

    await investmentTradeRepository.findByTaxYearId(1);
    await investmentTradeRepository.create({
      taxYearId: 1,
      tradedAt: new Date("2026-01-01T00:00:00.000Z"),
      symbol: "7203",
      assetType: "STOCK",
      type: "BUY",
      quantity: "100",
      unitPriceJpy: "2500",
    });
    await investmentTradeRepository.delete(1);

    expect(openClientDbMock).toHaveBeenCalledTimes(1);
    expect(openClientDbMock).toHaveBeenCalledWith("kakuteishinnkoku.db");
    expect(applyClientDbSchemaMock).toHaveBeenCalledTimes(1);
    expect(applyClientDbSchemaMock).toHaveBeenCalledWith(fakeDb);
  });

  it("createは共有ClientDbに対してSQLを発行する", async () => {
    const { investmentTradeRepository } = await import(
      "./defaultInvestmentTradeRepository.standalone"
    );

    await investmentTradeRepository.create({
      taxYearId: 1,
      tradedAt: new Date("2026-01-01T00:00:00.000Z"),
      symbol: "7203",
      assetType: "STOCK",
      type: "BUY",
      quantity: "100",
      unitPriceJpy: "2500",
    });

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO investment_trade"),
      expect.arrayContaining([1, "7203", "STOCK", "BUY", "100", "2500"]),
    );
  });

  it("deleteは共有ClientDbに対してSQLを発行する", async () => {
    const { investmentTradeRepository } = await import(
      "./defaultInvestmentTradeRepository.standalone"
    );

    await investmentTradeRepository.delete(1);

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM investment_trade"),
      [1],
    );
  });
});
