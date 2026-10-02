import { describe, expect, it, vi } from "vitest";
import type { TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { ForeignTaxCreditRecordRepository } from "@/lib/repositories/foreignTaxCreditRecordRepository";
import {
  deleteForeignTaxCreditRecordCore,
  saveForeignTaxCreditRecordCore,
} from "./foreignTaxCreditRecord";

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

function createFakeForeignTaxCreditRecordRepository(): ForeignTaxCreditRecordRepository {
  return {
    findByTaxYearId: vi.fn(async () => null),
    upsert: vi.fn(async () => {}),
    deleteByTaxYearId: vi.fn(async () => {}),
  };
}

describe("saveForeignTaxCreditRecordCore", () => {
  it("taxYearを取得・作成し、控除額をupsertして遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeForeignTaxCreditRecordRepository();

    const result = await saveForeignTaxCreditRecordCore(taxYearRepo, repo, {
      year: 2025,
      totalCreditJpy: "100000",
      nationalTaxCreditJpy: "80000",
      residentTaxCreditJpy: "20000",
    });

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2025);
    expect(repo.upsert).toHaveBeenCalledWith({
      taxYearId: 42,
      totalCreditJpy: "100000",
      nationalTaxCreditJpy: "80000",
      residentTaxCreditJpy: "20000",
    });
    expect(result).toEqual({
      redirectTo: "/foreign-tax-credit?year=2025&foreignTaxCreditSaved=1",
    });
  });
});

describe("deleteForeignTaxCreditRecordCore", () => {
  it("対象年のTaxYearが存在する場合、taxYearIdで削除して遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 7, year: 2024 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeForeignTaxCreditRecordRepository();

    const result = await deleteForeignTaxCreditRecordCore(taxYearRepo, repo, {
      year: 2024,
    });

    expect(taxYearRepo.findByYear).toHaveBeenCalledWith(2024);
    expect(repo.deleteByTaxYearId).toHaveBeenCalledWith(7);
    expect(result).toEqual({
      redirectTo: "/foreign-tax-credit?year=2024&foreignTaxCreditDeleted=1",
    });
  });

  it("対象年のTaxYearが存在しない場合、削除を呼ばずに遷移先のみ返す", async () => {
    const taxYearRepo = createFakeTaxYearRepository(null);
    const repo = createFakeForeignTaxCreditRecordRepository();

    const result = await deleteForeignTaxCreditRecordCore(taxYearRepo, repo, {
      year: 2023,
    });

    expect(repo.deleteByTaxYearId).not.toHaveBeenCalled();
    expect(result).toEqual({
      redirectTo: "/foreign-tax-credit?year=2023&foreignTaxCreditDeleted=1",
    });
  });
});
