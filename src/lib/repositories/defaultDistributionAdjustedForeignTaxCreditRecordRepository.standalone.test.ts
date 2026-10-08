/**
 * フェーズ5-3-3: `@/lib/repositories/defaultDistributionAdjustedForeignTaxCreditRecordRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultDistributionAdjustedForeignTaxCreditRecordRepository.standalone.ts`)が、`../clientDb/
 * standaloneClientDb.ts`経由で取得した`ClientDb`を
 * `createClientDistributionAdjustedForeignTaxCreditRecordRepository`に正しく結線していることを
 * 検証する(`createClientDistributionAdjustedForeignTaxCreditRecordRepository`自体の挙動は
 * `distributionAdjustedForeignTaxCreditRecordRepository.test.ts`で別途検証済みのため、ここでは
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
    credit_jpy: "12345",
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

describe("defaultDistributionAdjustedForeignTaxCreditRecordRepository (standalone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("共有のClientDb接続を1回だけ開き、全メソッドで再利用する", async () => {
    const { distributionAdjustedForeignTaxCreditRecordRepository } = await import(
      "./defaultDistributionAdjustedForeignTaxCreditRecordRepository.standalone"
    );

    await distributionAdjustedForeignTaxCreditRecordRepository.findByTaxYearId(1);
    await distributionAdjustedForeignTaxCreditRecordRepository.upsert({
      taxYearId: 1,
      creditJpy: "12345",
    });
    await distributionAdjustedForeignTaxCreditRecordRepository.deleteByTaxYearId(1);

    expect(openClientDbMock).toHaveBeenCalledTimes(1);
    expect(openClientDbMock).toHaveBeenCalledWith("kakuteishinnkoku.db");
    expect(applyClientDbSchemaMock).toHaveBeenCalledTimes(1);
    expect(applyClientDbSchemaMock).toHaveBeenCalledWith(fakeDb);
  });

  it("upsertは共有ClientDbに対してSQLを発行する", async () => {
    const { distributionAdjustedForeignTaxCreditRecordRepository } = await import(
      "./defaultDistributionAdjustedForeignTaxCreditRecordRepository.standalone"
    );

    await distributionAdjustedForeignTaxCreditRecordRepository.upsert({
      taxYearId: 1,
      creditJpy: "12345",
    });

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining(
        "INSERT INTO distribution_adjusted_foreign_tax_credit_record",
      ),
      expect.arrayContaining([1, "12345"]),
    );
  });

  it("deleteByTaxYearIdは共有ClientDbに対してSQLを発行する", async () => {
    const { distributionAdjustedForeignTaxCreditRecordRepository } = await import(
      "./defaultDistributionAdjustedForeignTaxCreditRecordRepository.standalone"
    );

    await distributionAdjustedForeignTaxCreditRecordRepository.deleteByTaxYearId(1);

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining(
        "DELETE FROM distribution_adjusted_foreign_tax_credit_record",
      ),
      [1],
    );
  });
});
