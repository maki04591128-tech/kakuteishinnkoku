/**
 * フェーズ5-3-3: `@/lib/repositories/defaultEmploymentIncomeRecordRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultEmploymentIncomeRecordRepository.standalone.ts`)が、`../clientDb/
 * standaloneClientDb.ts`経由で取得した`ClientDb`を
 * `createClientEmploymentIncomeRecordRepository`に正しく結線していることを
 * 検証する(`createClientEmploymentIncomeRecordRepository`自体の挙動は
 * `employmentIncomeRecordRepository.test.ts`で別途検証済みのため、ここでは
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
    gross_salary_jpy: "5000000",
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

describe("defaultEmploymentIncomeRecordRepository (standalone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("共有のClientDb接続を1回だけ開き、全メソッドで再利用する", async () => {
    const { employmentIncomeRecordRepository } = await import(
      "./defaultEmploymentIncomeRecordRepository.standalone"
    );

    await employmentIncomeRecordRepository.findByTaxYearId(1);
    await employmentIncomeRecordRepository.upsert({ taxYearId: 1, grossSalaryJpy: "5000000" });
    await employmentIncomeRecordRepository.deleteByTaxYearId(1);

    expect(openClientDbMock).toHaveBeenCalledTimes(1);
    expect(openClientDbMock).toHaveBeenCalledWith("kakuteishinnkoku.db");
    expect(applyClientDbSchemaMock).toHaveBeenCalledTimes(1);
    expect(applyClientDbSchemaMock).toHaveBeenCalledWith(fakeDb);
  });

  it("upsertは共有ClientDbに対してSQLを発行する", async () => {
    const { employmentIncomeRecordRepository } = await import(
      "./defaultEmploymentIncomeRecordRepository.standalone"
    );

    await employmentIncomeRecordRepository.upsert({ taxYearId: 1, grossSalaryJpy: "5000000" });

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO employment_income_record"),
      expect.arrayContaining([1, "5000000"]),
    );
  });

  it("deleteByTaxYearIdは共有ClientDbに対してSQLを発行する", async () => {
    const { employmentIncomeRecordRepository } = await import(
      "./defaultEmploymentIncomeRecordRepository.standalone"
    );

    await employmentIncomeRecordRepository.deleteByTaxYearId(1);

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM employment_income_record"),
      [1],
    );
  });
});
