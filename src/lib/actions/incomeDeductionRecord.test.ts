import { describe, expect, it, vi } from "vitest";
import type { TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { IncomeDeductionRepository } from "@/lib/repositories/incomeDeductionRepository";
import { deleteIncomeDeductionCore, saveIncomeDeductionCore } from "./incomeDeductionRecord";

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

function createFakeIncomeDeductionRepository(): IncomeDeductionRepository {
  return {
    findByTaxYearId: vi.fn(async () => []),
    upsert: vi.fn(async () => {}),
    deleteByTaxYearIdAndType: vi.fn(async () => {}),
  };
}

describe("saveIncomeDeductionCore", () => {
  it("taxYearを取得・作成し、区分ごとの控除額をupsertして遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeIncomeDeductionRepository();

    const result = await saveIncomeDeductionCore(taxYearRepo, repo, {
      year: 2025,
      type: "MEDICAL_EXPENSE",
      incomeTaxAmountJpy: "100000",
      residentTaxAmountJpy: "90000",
      redirectPath: "/medical-expense-deduction",
    });

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2025);
    expect(repo.upsert).toHaveBeenCalledWith({
      taxYearId: 42,
      type: "MEDICAL_EXPENSE",
      incomeTaxAmountJpy: "100000",
      residentTaxAmountJpy: "90000",
    });
    expect(result).toEqual({
      redirectTo: "/medical-expense-deduction?year=2025&deductionSaved=MEDICAL_EXPENSE",
    });
  });

  it("不正な所得控除区分の場合はエラーを投げる", async () => {
    const taxYearRepo = createFakeTaxYearRepository(createTaxYear());
    const repo = createFakeIncomeDeductionRepository();

    await expect(
      saveIncomeDeductionCore(taxYearRepo, repo, {
        year: 2025,
        type: "INVALID_TYPE",
        incomeTaxAmountJpy: "100000",
        residentTaxAmountJpy: "90000",
        redirectPath: "/medical-expense-deduction",
      }),
    ).rejects.toThrow("不正な所得控除区分です: INVALID_TYPE");
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});

describe("deleteIncomeDeductionCore", () => {
  it("対象年のTaxYearが存在する場合、taxYearIdと区分で削除して遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 7, year: 2024 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeIncomeDeductionRepository();

    const result = await deleteIncomeDeductionCore(taxYearRepo, repo, {
      year: 2024,
      type: "MEDICAL_EXPENSE",
      redirectPath: "/medical-expense-deduction",
    });

    expect(taxYearRepo.findByYear).toHaveBeenCalledWith(2024);
    expect(repo.deleteByTaxYearIdAndType).toHaveBeenCalledWith(7, "MEDICAL_EXPENSE");
    expect(result).toEqual({
      redirectTo: "/medical-expense-deduction?year=2024&deductionDeleted=MEDICAL_EXPENSE",
    });
  });

  it("対象年のTaxYearが存在しない場合、削除を呼ばずに遷移先のみ返す", async () => {
    const taxYearRepo = createFakeTaxYearRepository(null);
    const repo = createFakeIncomeDeductionRepository();

    const result = await deleteIncomeDeductionCore(taxYearRepo, repo, {
      year: 2023,
      type: "MEDICAL_EXPENSE",
      redirectPath: "/medical-expense-deduction",
    });

    expect(repo.deleteByTaxYearIdAndType).not.toHaveBeenCalled();
    expect(result).toEqual({
      redirectTo: "/medical-expense-deduction?year=2023&deductionDeleted=MEDICAL_EXPENSE",
    });
  });

  it("不正な所得控除区分の場合はエラーを投げる", async () => {
    const taxYearRepo = createFakeTaxYearRepository(createTaxYear());
    const repo = createFakeIncomeDeductionRepository();

    await expect(
      deleteIncomeDeductionCore(taxYearRepo, repo, {
        year: 2025,
        type: "INVALID_TYPE",
        redirectPath: "/medical-expense-deduction",
      }),
    ).rejects.toThrow("不正な所得控除区分です: INVALID_TYPE");
    expect(repo.deleteByTaxYearIdAndType).not.toHaveBeenCalled();
  });
});
