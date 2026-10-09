/**
 * フェーズ5-3-3: `@/lib/repositories/defaultNisaLifetimeQuotaRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultNisaLifetimeQuotaRepository.standalone.ts`)が、`../clientDb/
 * standaloneClientDb.ts`経由で取得した`ClientDb`を
 * `createClientNisaLifetimeQuotaRepository`に正しく結線していることを
 * 検証する(`createClientNisaLifetimeQuotaRepository`自体の挙動は
 * `nisaLifetimeQuotaRepository.test.ts`で別途検証済みのため、ここでは
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
    nisa_type: "TSUMITATE",
    opening_used_jpy: "1000000",
    sold_cost_basis_jpy: "0",
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

describe("defaultNisaLifetimeQuotaRepository (standalone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("共有のClientDb接続を1回だけ開き、全メソッドで再利用する", async () => {
    const { nisaLifetimeQuotaRepository } = await import(
      "./defaultNisaLifetimeQuotaRepository.standalone"
    );

    await nisaLifetimeQuotaRepository.findByTaxYearId(1);
    await nisaLifetimeQuotaRepository.upsert({
      taxYearId: 1,
      nisaType: "TSUMITATE",
      openingUsedJpy: "1000000",
      soldCostBasisJpy: "0",
    });
    await nisaLifetimeQuotaRepository.delete(1);
    await nisaLifetimeQuotaRepository.createMany([
      { taxYearId: 1, nisaType: "TSUMITATE", openingUsedJpy: "1000000" },
    ]);

    expect(openClientDbMock).toHaveBeenCalledTimes(1);
    expect(openClientDbMock).toHaveBeenCalledWith("kakuteishinnkoku.db");
    expect(applyClientDbSchemaMock).toHaveBeenCalledTimes(1);
    expect(applyClientDbSchemaMock).toHaveBeenCalledWith(fakeDb);
  });

  it("upsertは共有ClientDbに対してSQLを発行する", async () => {
    const { nisaLifetimeQuotaRepository } = await import(
      "./defaultNisaLifetimeQuotaRepository.standalone"
    );

    await nisaLifetimeQuotaRepository.upsert({
      taxYearId: 1,
      nisaType: "TSUMITATE",
      openingUsedJpy: "1000000",
      soldCostBasisJpy: "0",
    });

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO nisa_lifetime_quota"),
      expect.arrayContaining([1, "TSUMITATE", "1000000", "0"]),
    );
  });

  it("deleteは共有ClientDbに対してSQLを発行する", async () => {
    const { nisaLifetimeQuotaRepository } = await import(
      "./defaultNisaLifetimeQuotaRepository.standalone"
    );

    await nisaLifetimeQuotaRepository.delete(1);

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM nisa_lifetime_quota"),
      [1],
    );
  });

  it("createManyは共有ClientDbに対してSQLを発行する", async () => {
    const { nisaLifetimeQuotaRepository } = await import(
      "./defaultNisaLifetimeQuotaRepository.standalone"
    );

    await nisaLifetimeQuotaRepository.createMany([
      { taxYearId: 1, nisaType: "TSUMITATE", openingUsedJpy: "1000000" },
    ]);

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO nisa_lifetime_quota"),
      expect.arrayContaining([1, "TSUMITATE", "1000000"]),
    );
  });
});
