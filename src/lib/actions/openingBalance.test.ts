import { describe, expect, it, vi } from "vitest";
import type { TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { OpeningBalanceRepository } from "@/lib/repositories/openingBalanceRepository";
import {
  deleteOpeningBalanceCore,
  setOpeningBalanceCore,
} from "./openingBalance";

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

function createFakeOpeningBalanceRepository(): OpeningBalanceRepository {
  return {
    findByTaxYearId: vi.fn(async () => []),
    upsert: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    createMany: vi.fn(async () => {}),
  };
}

describe("setOpeningBalanceCore", () => {
  it("NISA口座かつ非上場株式の場合はエラーになる", async () => {
    const taxYearRepo = createFakeTaxYearRepository(createTaxYear());
    const repo = createFakeOpeningBalanceRepository();

    await expect(
      setOpeningBalanceCore(taxYearRepo, repo, {
        year: 2025,
        assetClass: "INVESTMENT",
        symbol: "AAPL",
        isNisa: true,
        isListed: false,
        quantity: "10",
        costBasisJpy: "100000",
      }),
    ).rejects.toThrow("一般株式等(非上場株式)はNISA口座の対象外です");
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it("taxYearを取得・作成し、期首残高をupsertして遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeOpeningBalanceRepository();

    const result = await setOpeningBalanceCore(taxYearRepo, repo, {
      year: 2025,
      assetClass: "CRYPTO",
      symbol: "BTC",
      isNisa: false,
      isListed: true,
      quantity: "1.5",
      costBasisJpy: "5000000",
    });

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2025);
    expect(repo.upsert).toHaveBeenCalledWith({
      taxYearId: 42,
      assetClass: "CRYPTO",
      symbol: "BTC",
      isNisa: false,
      isListed: true,
      quantity: "1.5",
      costBasisJpy: "5000000",
    });
    expect(result).toEqual({ redirectTo: "/import?year=2025&tab=opening" });
  });
});

describe("deleteOpeningBalanceCore", () => {
  it("指定IDを削除し、遷移先を返す", async () => {
    const repo = createFakeOpeningBalanceRepository();

    const result = await deleteOpeningBalanceCore(repo, { id: 9, year: 2024 });

    expect(repo.delete).toHaveBeenCalledWith(9);
    expect(result).toEqual({ redirectTo: "/import?year=2024&tab=opening" });
  });
});
