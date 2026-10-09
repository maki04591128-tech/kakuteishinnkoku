/**
 * フェーズ5-3-3: `@/lib/repositories/defaultMarketPriceRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultMarketPriceRepository.standalone.ts`)が、`../clientDb/
 * standaloneClientDb.ts`経由で取得した`ClientDb`を
 * `createClientMarketPriceRepository`に正しく結線していることを
 * 検証する(`createClientMarketPriceRepository`自体の挙動は
 * `marketPriceRepository.test.ts`で別途検証済みのため、ここでは
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
    symbol: "7203",
    price_jpy: "3000",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  };
  const fakeDb: ClientDb = {
    run: vi.fn(async () => {}),
    all: vi.fn(async () => [row]),
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

describe("defaultMarketPriceRepository (standalone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("共有のClientDb接続を1回だけ開き、全メソッドで再利用する", async () => {
    const { marketPriceRepository } = await import(
      "./defaultMarketPriceRepository.standalone"
    );

    await marketPriceRepository.findMany();
    await marketPriceRepository.upsert({ symbol: "7203", priceJpy: "3000" });
    await marketPriceRepository.delete(1);

    expect(openClientDbMock).toHaveBeenCalledTimes(1);
    expect(openClientDbMock).toHaveBeenCalledWith("kakuteishinnkoku.db");
    expect(applyClientDbSchemaMock).toHaveBeenCalledTimes(1);
    expect(applyClientDbSchemaMock).toHaveBeenCalledWith(fakeDb);
  });

  it("upsertは共有ClientDbに対してSQLを発行する", async () => {
    const { marketPriceRepository } = await import(
      "./defaultMarketPriceRepository.standalone"
    );

    await marketPriceRepository.upsert({ symbol: "7203", priceJpy: "3000" });

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO market_price"),
      expect.arrayContaining(["7203", "3000"]),
    );
  });

  it("deleteは共有ClientDbに対してSQLを発行する", async () => {
    const { marketPriceRepository } = await import(
      "./defaultMarketPriceRepository.standalone"
    );

    await marketPriceRepository.delete(1);

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM market_price"),
      [1],
    );
  });
});
