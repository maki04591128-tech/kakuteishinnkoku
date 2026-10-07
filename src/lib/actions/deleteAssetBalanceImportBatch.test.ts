import { describe, expect, it, vi } from "vitest";
import type { AssetBalanceSnapshotRepository } from "@/lib/repositories/assetBalanceSnapshotRepository";
import { deleteAssetBalanceImportBatchCore } from "./deleteAssetBalanceImportBatch";

function createFakeAssetBalanceSnapshotRepository(): AssetBalanceSnapshotRepository {
  return {
    findByTaxYearId: vi.fn(async () => []),
    findImportBatchesWithSnapshots: vi.fn(async () => []),
    importCsvBatch: vi.fn(async () => {}),
    deleteImportBatch: vi.fn(async () => {}),
  };
}

describe("deleteAssetBalanceImportBatchCore", () => {
  it("指定したインポートバッチを削除し、assetBalanceタブへの遷移先を返す", async () => {
    const repo = createFakeAssetBalanceSnapshotRepository();

    const result = await deleteAssetBalanceImportBatchCore(repo, {
      importBatchId: 10,
      year: 2025,
    });

    expect(repo.deleteImportBatch).toHaveBeenCalledWith(10);
    expect(result).toEqual({ redirectTo: "/import?year=2025&tab=assetBalance" });
  });
});
