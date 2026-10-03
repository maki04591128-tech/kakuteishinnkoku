import { describe, expect, it, vi } from "vitest";
import type { TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { OpeningBalanceByInstitutionRepository } from "@/lib/repositories/openingBalanceByInstitutionRepository";
import {
  deleteOpeningBalanceByInstitutionCore,
  setOpeningBalanceByInstitutionCore,
} from "./openingBalanceByInstitution";

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

function createFakeOpeningBalanceByInstitutionRepository(): OpeningBalanceByInstitutionRepository {
  return {
    findByTaxYearId: vi.fn(async () => []),
    upsert: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
  };
}

describe("setOpeningBalanceByInstitutionCore", () => {
  it("taxYearを取得・作成し、金融機関別内訳をupsertして遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeOpeningBalanceByInstitutionRepository();

    const result = await setOpeningBalanceByInstitutionCore(taxYearRepo, repo, {
      year: 2025,
      assetClass: "CRYPTO",
      symbol: "BTC",
      institution: "bitFlyer",
      quantity: "1.5",
    });

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2025);
    expect(repo.upsert).toHaveBeenCalledWith({
      taxYearId: 42,
      assetClass: "CRYPTO",
      symbol: "BTC",
      institution: "bitFlyer",
      quantity: "1.5",
    });
    expect(result).toEqual({
      redirectTo: "/import?year=2025&tab=assetBalance",
    });
  });
});

describe("deleteOpeningBalanceByInstitutionCore", () => {
  it("指定IDを削除し、遷移先を返す", async () => {
    const repo = createFakeOpeningBalanceByInstitutionRepository();

    const result = await deleteOpeningBalanceByInstitutionCore(repo, {
      id: 9,
      year: 2024,
    });

    expect(repo.delete).toHaveBeenCalledWith(9);
    expect(result).toEqual({
      redirectTo: "/import?year=2024&tab=assetBalance",
    });
  });
});
