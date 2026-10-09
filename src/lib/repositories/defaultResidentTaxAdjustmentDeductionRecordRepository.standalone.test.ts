/**
 * フェーズ5-3-3: `@/lib/repositories/defaultResidentTaxAdjustmentDeductionRecordRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultResidentTaxAdjustmentDeductionRecordRepository.standalone.ts`)が、`../clientDb/
 * standaloneClientDb.ts`経由で取得した`ClientDb`を
 * `createClientResidentTaxAdjustmentDeductionRecordRepository`に正しく結線していることを
 * 検証する(`createClientResidentTaxAdjustmentDeductionRecordRepository`自体の挙動は
 * `residentTaxAdjustmentDeductionRecordRepository.test.ts`で別途検証済みのため、ここでは
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
    adjustment_deduction_jpy: "50000",
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

describe("defaultResidentTaxAdjustmentDeductionRecordRepository (standalone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("共有のClientDb接続を1回だけ開き、全メソッドで再利用する", async () => {
    const { residentTaxAdjustmentDeductionRecordRepository } = await import(
      "./defaultResidentTaxAdjustmentDeductionRecordRepository.standalone"
    );

    await residentTaxAdjustmentDeductionRecordRepository.findByTaxYearId(1);
    await residentTaxAdjustmentDeductionRecordRepository.upsert({
      taxYearId: 1,
      adjustmentDeductionJpy: "50000",
    });
    await residentTaxAdjustmentDeductionRecordRepository.deleteByTaxYearId(1);

    expect(openClientDbMock).toHaveBeenCalledTimes(1);
    expect(openClientDbMock).toHaveBeenCalledWith("kakuteishinnkoku.db");
    expect(applyClientDbSchemaMock).toHaveBeenCalledTimes(1);
    expect(applyClientDbSchemaMock).toHaveBeenCalledWith(fakeDb);
  });

  it("upsertは共有ClientDbに対してSQLを発行する", async () => {
    const { residentTaxAdjustmentDeductionRecordRepository } = await import(
      "./defaultResidentTaxAdjustmentDeductionRecordRepository.standalone"
    );

    await residentTaxAdjustmentDeductionRecordRepository.upsert({
      taxYearId: 1,
      adjustmentDeductionJpy: "50000",
    });

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining(
        "INSERT INTO resident_tax_adjustment_deduction_record",
      ),
      expect.arrayContaining([1, "50000"]),
    );
  });

  it("deleteByTaxYearIdは共有ClientDbに対してSQLを発行する", async () => {
    const { residentTaxAdjustmentDeductionRecordRepository } = await import(
      "./defaultResidentTaxAdjustmentDeductionRecordRepository.standalone"
    );

    await residentTaxAdjustmentDeductionRecordRepository.deleteByTaxYearId(1);

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining(
        "DELETE FROM resident_tax_adjustment_deduction_record",
      ),
      [1],
    );
  });
});
