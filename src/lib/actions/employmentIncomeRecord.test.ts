import { describe, expect, it, vi } from "vitest";
import type { TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { EmploymentIncomeRecordRepository } from "@/lib/repositories/employmentIncomeRecordRepository";
import {
  deleteEmploymentIncomeRecordCore,
  saveEmploymentIncomeRecordCore,
} from "./employmentIncomeRecord";

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

function createFakeEmploymentIncomeRecordRepository(): EmploymentIncomeRecordRepository {
  return {
    findByTaxYearId: vi.fn(async () => null),
    upsert: vi.fn(async () => {}),
    deleteByTaxYearId: vi.fn(async () => {}),
  };
}

describe("saveEmploymentIncomeRecordCore", () => {
  it("taxYearを取得・作成し、給与収入金額をupsertして遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeEmploymentIncomeRecordRepository();

    const result = await saveEmploymentIncomeRecordCore(taxYearRepo, repo, {
      year: 2025,
      grossSalaryJpy: "5000000",
    });

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2025);
    expect(repo.upsert).toHaveBeenCalledWith({
      taxYearId: 42,
      grossSalaryJpy: "5000000",
    });
    expect(result).toEqual({
      redirectTo: "/employment-income?year=2025&employmentIncomeSaved=1",
    });
  });
});

describe("deleteEmploymentIncomeRecordCore", () => {
  it("対象年のTaxYearが存在する場合、taxYearIdで削除して遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 7, year: 2024 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeEmploymentIncomeRecordRepository();

    const result = await deleteEmploymentIncomeRecordCore(taxYearRepo, repo, {
      year: 2024,
    });

    expect(taxYearRepo.findByYear).toHaveBeenCalledWith(2024);
    expect(repo.deleteByTaxYearId).toHaveBeenCalledWith(7);
    expect(result).toEqual({
      redirectTo: "/employment-income?year=2024&employmentIncomeDeleted=1",
    });
  });

  it("対象年のTaxYearが存在しない場合、削除を呼ばずに遷移先のみ返す", async () => {
    const taxYearRepo = createFakeTaxYearRepository(null);
    const repo = createFakeEmploymentIncomeRecordRepository();

    const result = await deleteEmploymentIncomeRecordCore(taxYearRepo, repo, {
      year: 2023,
    });

    expect(repo.deleteByTaxYearId).not.toHaveBeenCalled();
    expect(result).toEqual({
      redirectTo: "/employment-income?year=2023&employmentIncomeDeleted=1",
    });
  });
});
