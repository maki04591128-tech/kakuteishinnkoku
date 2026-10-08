import { describe, expect, it, vi } from "vitest";
import type { TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { AssetBalanceSnapshotRepository } from "@/lib/repositories/assetBalanceSnapshotRepository";
import { importAssetBalanceCsvCore } from "./importAssetBalanceCsv";

function createFakeTaxYearRepository(taxYear: TaxYear): TaxYearRepository {
  return {
    getOrCreateTaxYear: vi.fn(async () => taxYear),
    findByYear: vi.fn(async () => taxYear),
    listTaxYears: vi.fn(async () => [taxYear.year]),
    updateCryptoCostMethod: vi.fn(async () => {}),
  };
}

function createTaxYear(overrides: Partial<TaxYear> = {}): TaxYear {
  return {
    id: 1,
    year: 2025,
    cryptoCostMethod: "AVERAGE",
    createdAt: new Date("2025-01-01"),
    ...overrides,
  } as TaxYear;
}

function createFakeAssetBalanceSnapshotRepository(): AssetBalanceSnapshotRepository {
  return {
    findByTaxYearId: vi.fn(async () => []),
    findImportBatchesWithSnapshots: vi.fn(async () => []),
    importCsvBatch: vi.fn(async () => {}),
    deleteImportBatch: vi.fn(async () => {}),
  };
}

describe("importAssetBalanceCsvCore", () => {
  it("CSVを解析してインポートし、スキップ無しの場合の遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeAssetBalanceSnapshotRepository();

    const csvText = [
      "金融機関,資産名,残高",
      "SBI証券,日本株,100000",
      "楽天証券,投資信託,200000",
    ].join("\n");

    const result = await importAssetBalanceCsvCore(taxYearRepo, repo, {
      year: 2025,
      fileName: "assets.csv",
      csvText,
      mapping: {
        institutionColumn: "金融機関",
        assetNameColumn: "資産名",
        balanceColumn: "残高",
      },
    });

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2025);
    expect(repo.importCsvBatch).toHaveBeenCalledWith({
      taxYearId: 42,
      sourceType: "moneyforward_assets",
      fileName: "assets.csv",
      rows: [
        {
          snapshotDate: null,
          category: "",
          institution: "SBI証券",
          assetName: "日本株",
          balanceJpy: "100000",
          quantity: null,
        },
        {
          snapshotDate: null,
          category: "",
          institution: "楽天証券",
          assetName: "投資信託",
          balanceJpy: "200000",
          quantity: null,
        },
      ],
    });
    expect(result).toEqual({
      importedRowCount: 2,
      skippedRowCount: 0,
      redirectTo: "/import?year=2025&tab=assetBalance&imported=2",
    });
  });

  it("必須項目が空の行はスキップし、遷移先にskippedを含める", async () => {
    const taxYear = createTaxYear({ id: 7, year: 2024 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeAssetBalanceSnapshotRepository();

    const csvText = ["金融機関,資産名,残高", "SBI証券,日本株,100000", ",,"].join("\n");

    const result = await importAssetBalanceCsvCore(taxYearRepo, repo, {
      year: 2024,
      fileName: "assets.csv",
      csvText,
      mapping: {
        institutionColumn: "金融機関",
        assetNameColumn: "資産名",
        balanceColumn: "残高",
      },
    });

    expect(result).toEqual({
      importedRowCount: 1,
      skippedRowCount: 1,
      redirectTo: "/import?year=2024&tab=assetBalance&imported=1&skipped=1",
    });
  });
});
