/**
 * フェーズ5-3-3: `@/lib/repositories/defaultBarrierFreeRenovationDeductionRecordRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultBarrierFreeRenovationDeductionRecordRepository.standalone.ts`)が、`../clientDb/
 * standaloneClientDb.ts`経由で取得した`ClientDb`を
 * `createClientBarrierFreeRenovationDeductionRecordRepository`に正しく結線していることを
 * 検証する(`createClientBarrierFreeRenovationDeductionRecordRepository`自体の挙動は
 * `barrierFreeRenovationDeductionRecordRepository.test.ts`で別途検証済みのため、ここでは
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
    credit_jpy: "150000",
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

describe("defaultBarrierFreeRenovationDeductionRecordRepository (standalone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("共有のClientDb接続を1回だけ開き、全メソッドで再利用する", async () => {
    const { barrierFreeRenovationDeductionRecordRepository } = await import(
      "./defaultBarrierFreeRenovationDeductionRecordRepository.standalone"
    );

    await barrierFreeRenovationDeductionRecordRepository.findByTaxYearId(1);
    await barrierFreeRenovationDeductionRecordRepository.upsert({
      taxYearId: 1,
      creditJpy: "150000",
    });
    await barrierFreeRenovationDeductionRecordRepository.deleteByTaxYearId(1);

    expect(openClientDbMock).toHaveBeenCalledTimes(1);
    expect(openClientDbMock).toHaveBeenCalledWith("kakuteishinnkoku.db");
    expect(applyClientDbSchemaMock).toHaveBeenCalledTimes(1);
    expect(applyClientDbSchemaMock).toHaveBeenCalledWith(fakeDb);
  });

  it("upsertは共有ClientDbに対してSQLを発行する", async () => {
    const { barrierFreeRenovationDeductionRecordRepository } = await import(
      "./defaultBarrierFreeRenovationDeductionRecordRepository.standalone"
    );

    await barrierFreeRenovationDeductionRecordRepository.upsert({
      taxYearId: 1,
      creditJpy: "150000",
    });

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO barrier_free_renovation_deduction_record"),
      expect.arrayContaining([1, "150000"]),
    );
  });

  it("deleteByTaxYearIdは共有ClientDbに対してSQLを発行する", async () => {
    const { barrierFreeRenovationDeductionRecordRepository } = await import(
      "./defaultBarrierFreeRenovationDeductionRecordRepository.standalone"
    );

    await barrierFreeRenovationDeductionRecordRepository.deleteByTaxYearId(1);

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM barrier_free_renovation_deduction_record"),
      [1],
    );
  });
});
