/**
 * フェーズ5-3-2: `@/lib/repositories/defaultTaxYearRepository`のスタンドアロン版
 * 差し替え実装(`defaultTaxYearRepository.standalone.ts`)が、`../clientDb/
 * standaloneClientDb.ts`経由で取得した`ClientDb`を`createClientTaxYearRepository`
 * に正しく結線していることを検証する(`createClientTaxYearRepository`自体の
 * 挙動は`taxYearRepository.test.ts`で別途検証済みのため、ここでは委譲先の
 * `ClientDb`が共有・再利用されていることを中心に確認する)。
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
    year: 2025,
    crypto_cost_method: "AVERAGE",
    created_at: "2025-01-01T00:00:00.000Z",
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

describe("defaultTaxYearRepository (standalone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("共有のClientDb接続を1回だけ開き、全メソッドで再利用する", async () => {
    const { taxYearRepository } = await import("./defaultTaxYearRepository.standalone");

    await taxYearRepository.listTaxYears();
    await taxYearRepository.findByYear(2025);
    await taxYearRepository.getOrCreateTaxYear(2025);

    expect(openClientDbMock).toHaveBeenCalledTimes(1);
    expect(openClientDbMock).toHaveBeenCalledWith("kakuteishinnkoku.db");
    expect(applyClientDbSchemaMock).toHaveBeenCalledTimes(1);
    expect(applyClientDbSchemaMock).toHaveBeenCalledWith(fakeDb);
  });

  it("getOrCreateTaxYearは共有ClientDbに対してSQLを発行する", async () => {
    const { taxYearRepository } = await import("./defaultTaxYearRepository.standalone");

    await taxYearRepository.getOrCreateTaxYear(2025);

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO tax_year"),
      expect.arrayContaining([2025]),
    );
  });

  it("updateCryptoCostMethodは共有ClientDbに対してSQLを発行する", async () => {
    const { taxYearRepository } = await import("./defaultTaxYearRepository.standalone");

    await taxYearRepository.updateCryptoCostMethod(1, "MOVING_AVERAGE");

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE tax_year"),
      ["MOVING_AVERAGE", 1],
    );
  });
});
