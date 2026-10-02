import { describe, expect, it, vi } from "vitest";
import type { TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { DistributionAdjustedForeignTaxCreditRecordRepository } from "@/lib/repositories/distributionAdjustedForeignTaxCreditRecordRepository";
import {
  deleteDistributionAdjustedForeignTaxCreditRecordCore,
  saveDistributionAdjustedForeignTaxCreditRecordCore,
} from "./distributionAdjustedForeignTaxCreditRecord";

function createFakeTaxYearRepository(taxYear: TaxYear | null): TaxYearRepository {
  return {
    getOrCreateTaxYear: vi.fn(async () => taxYear as TaxYear),
    findByYear: vi.fn(async () => taxYear),
    listTaxYears: vi.fn(async () => (taxYear ? [taxYear.year] : [])),
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

function createFakeDistributionAdjustedForeignTaxCreditRecordRepository(): DistributionAdjustedForeignTaxCreditRecordRepository {
  return {
    findByTaxYearId: vi.fn(async () => null),
    upsert: vi.fn(async () => {}),
    deleteByTaxYearId: vi.fn(async () => {}),
  };
}

describe("saveDistributionAdjustedForeignTaxCreditRecordCore", () => {
  it("taxYearを取得・作成し、控除額をupsertして遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeDistributionAdjustedForeignTaxCreditRecordRepository();

    const result = await saveDistributionAdjustedForeignTaxCreditRecordCore(taxYearRepo, repo, {
      year: 2025,
      creditJpy: "150000",
    });

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2025);
    expect(repo.upsert).toHaveBeenCalledWith({
      taxYearId: 42,
      creditJpy: "150000",
    });
    expect(result).toEqual({
      redirectTo: "/distribution-adjusted-foreign-tax-credit?year=2025&saved=1",
    });
  });
});

describe("deleteDistributionAdjustedForeignTaxCreditRecordCore", () => {
  it("対象年のTaxYearが存在する場合、taxYearIdで削除して遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 7, year: 2024 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeDistributionAdjustedForeignTaxCreditRecordRepository();

    const result = await deleteDistributionAdjustedForeignTaxCreditRecordCore(taxYearRepo, repo, {
      year: 2024,
    });

    expect(taxYearRepo.findByYear).toHaveBeenCalledWith(2024);
    expect(repo.deleteByTaxYearId).toHaveBeenCalledWith(7);
    expect(result).toEqual({
      redirectTo: "/distribution-adjusted-foreign-tax-credit?year=2024&deleted=1",
    });
  });

  it("対象年のTaxYearが存在しない場合、削除を呼ばずに遷移先のみ返す", async () => {
    const taxYearRepo = createFakeTaxYearRepository(null);
    const repo = createFakeDistributionAdjustedForeignTaxCreditRecordRepository();

    const result = await deleteDistributionAdjustedForeignTaxCreditRecordCore(taxYearRepo, repo, {
      year: 2023,
    });

    expect(repo.deleteByTaxYearId).not.toHaveBeenCalled();
    expect(result).toEqual({
      redirectTo: "/distribution-adjusted-foreign-tax-credit?year=2023&deleted=1",
    });
  });
});
