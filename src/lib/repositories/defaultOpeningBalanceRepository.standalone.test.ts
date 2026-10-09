/**
 * フェーズ5-3-3: `@/lib/repositories/defaultOpeningBalanceRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultOpeningBalanceRepository.standalone.ts`)が、`../clientDb/
 * standaloneClientDb.ts`経由で取得した`ClientDb`を
 * `createClientOpeningBalanceRepository`に正しく結線していることを
 * 検証する(`createClientOpeningBalanceRepository`自体の挙動は
 * `openingBalanceRepository.test.ts`で別途検証済みのため、ここでは
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
    asset_class: "INVESTMENT",
    symbol: "1234",
    is_nisa: 0,
    is_listed: 1,
    quantity: "100",
    cost_basis_jpy: "500000",
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

describe("defaultOpeningBalanceRepository (standalone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("共有のClientDb接続を1回だけ開き、全メソッドで再利用する", async () => {
    const { openingBalanceRepository } = await import(
      "./defaultOpeningBalanceRepository.standalone"
    );

    await openingBalanceRepository.findByTaxYearId(1);
    await openingBalanceRepository.upsert({
      taxYearId: 1,
      assetClass: "INVESTMENT",
      symbol: "1234",
      isNisa: false,
      isListed: true,
      quantity: "100",
      costBasisJpy: "500000",
    });
    await openingBalanceRepository.delete(1);
    await openingBalanceRepository.createMany([
      {
        taxYearId: 1,
        assetClass: "INVESTMENT",
        symbol: "1234",
        isNisa: false,
        isListed: true,
        quantity: "100",
        costBasisJpy: "500000",
      },
    ]);

    expect(openClientDbMock).toHaveBeenCalledTimes(1);
    expect(openClientDbMock).toHaveBeenCalledWith("kakuteishinnkoku.db");
    expect(applyClientDbSchemaMock).toHaveBeenCalledTimes(1);
    expect(applyClientDbSchemaMock).toHaveBeenCalledWith(fakeDb);
  });

  it("upsertは共有ClientDbに対してSQLを発行する", async () => {
    const { openingBalanceRepository } = await import(
      "./defaultOpeningBalanceRepository.standalone"
    );

    await openingBalanceRepository.upsert({
      taxYearId: 1,
      assetClass: "INVESTMENT",
      symbol: "1234",
      isNisa: false,
      isListed: true,
      quantity: "100",
      costBasisJpy: "500000",
    });

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO opening_balance"),
      expect.arrayContaining([1, "INVESTMENT", "1234", "100", "500000"]),
    );
  });

  it("deleteは共有ClientDbに対してSQLを発行する", async () => {
    const { openingBalanceRepository } = await import(
      "./defaultOpeningBalanceRepository.standalone"
    );

    await openingBalanceRepository.delete(1);

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM opening_balance"),
      [1],
    );
  });

  it("createManyは共有ClientDbに対してSQLを発行する", async () => {
    const { openingBalanceRepository } = await import(
      "./defaultOpeningBalanceRepository.standalone"
    );

    await openingBalanceRepository.createMany([
      {
        taxYearId: 1,
        assetClass: "INVESTMENT",
        symbol: "1234",
        isNisa: false,
        isListed: true,
        quantity: "100",
        costBasisJpy: "500000",
      },
    ]);

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO opening_balance"),
      expect.arrayContaining([1, "INVESTMENT", "1234", "100", "500000"]),
    );
  });
});
