/**
 * フェーズ5-3-3: `@/lib/repositories/defaultAssetBalanceSnapshotRepository`の
 * スタンドアロン版差し替え実装
 * (`defaultAssetBalanceSnapshotRepository.standalone.ts`)が、`../clientDb/
 * standaloneClientDb.ts`経由で取得した`ClientDb`を
 * `createClientAssetBalanceSnapshotRepository`に正しく結線していることを
 * 検証する(`createClientAssetBalanceSnapshotRepository`自体の挙動は
 * `assetBalanceSnapshotRepository.test.ts`で別途検証済みのため、ここでは
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
  const snapshotRow: Record<string, SqlValue> = {
    id: 1,
    tax_year_id: 1,
    snapshot_date: "2025-01-01T00:00:00.000Z",
    category: "証券",
    institution: "SBI証券",
    asset_name: "トヨタ自動車",
    balance_jpy: "1000000",
    quantity: "100",
    import_batch_id: 1,
    created_at: "2025-01-01T00:00:00.000Z",
  };
  const importBatchRow: Record<string, SqlValue> = {
    id: 1,
    tax_year_id: 1,
    source_type: "sbi",
    file_name: "balance.csv",
    imported_at: "2025-01-01T00:00:00.000Z",
    row_count: 1,
  };
  const all = vi.fn(async (sql: string): Promise<Record<string, SqlValue>[]> => {
    if (sql.includes("last_insert_rowid")) {
      return [{ id: 1 }];
    }
    if (sql.includes("FROM import_batch")) {
      return [importBatchRow];
    }
    return [snapshotRow];
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

describe("defaultAssetBalanceSnapshotRepository (standalone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("共有のClientDb接続を1回だけ開き、全メソッドで再利用する", async () => {
    const { assetBalanceSnapshotRepository } = await import(
      "./defaultAssetBalanceSnapshotRepository.standalone"
    );

    await assetBalanceSnapshotRepository.findByTaxYearId(1);
    await assetBalanceSnapshotRepository.findImportBatchesWithSnapshots({
      taxYearId: 1,
      sourceType: "sbi",
    });
    await assetBalanceSnapshotRepository.importCsvBatch({
      taxYearId: 1,
      sourceType: "sbi",
      fileName: "balance.csv",
      rows: [
        {
          snapshotDate: null,
          category: "証券",
          institution: "SBI証券",
          assetName: "トヨタ自動車",
          balanceJpy: "1000000",
          quantity: "100",
        },
      ],
    });
    await assetBalanceSnapshotRepository.deleteImportBatch(1);

    expect(openClientDbMock).toHaveBeenCalledTimes(1);
    expect(openClientDbMock).toHaveBeenCalledWith("kakuteishinnkoku.db");
    expect(applyClientDbSchemaMock).toHaveBeenCalledTimes(1);
    expect(applyClientDbSchemaMock).toHaveBeenCalledWith(fakeDb);
  });

  it("importCsvBatchは共有ClientDbに対してSQLを発行する", async () => {
    const { assetBalanceSnapshotRepository } = await import(
      "./defaultAssetBalanceSnapshotRepository.standalone"
    );

    await assetBalanceSnapshotRepository.importCsvBatch({
      taxYearId: 1,
      sourceType: "sbi",
      fileName: "balance.csv",
      rows: [
        {
          snapshotDate: null,
          category: "証券",
          institution: "SBI証券",
          assetName: "トヨタ自動車",
          balanceJpy: "1000000",
          quantity: "100",
        },
      ],
    });

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO import_batch"),
      expect.arrayContaining([1, "sbi", "balance.csv"]),
    );
    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO asset_balance_snapshot"),
      expect.arrayContaining(["証券", "SBI証券", "トヨタ自動車", "1000000", "100"]),
    );
  });

  it("deleteImportBatchは共有ClientDbに対してSQLを発行する", async () => {
    const { assetBalanceSnapshotRepository } = await import(
      "./defaultAssetBalanceSnapshotRepository.standalone"
    );

    await assetBalanceSnapshotRepository.deleteImportBatch(1);

    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM asset_balance_snapshot"),
      [1],
    );
    expect(fakeDb.run).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM import_batch"),
      [1],
    );
  });
});
