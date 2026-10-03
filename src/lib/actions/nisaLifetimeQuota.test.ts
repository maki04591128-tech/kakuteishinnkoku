import { describe, expect, it, vi } from "vitest";
import type { TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { NisaLifetimeQuotaRepository } from "@/lib/repositories/nisaLifetimeQuotaRepository";
import {
  deleteNisaLifetimeQuotaCore,
  setNisaLifetimeQuotaCore,
} from "./nisaLifetimeQuota";

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

function createFakeNisaLifetimeQuotaRepository(): NisaLifetimeQuotaRepository {
  return {
    findByTaxYearId: vi.fn(async () => []),
    upsert: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    createMany: vi.fn(async () => {}),
  };
}

describe("setNisaLifetimeQuotaCore", () => {
  it("nisaTypeがTSUMITATE/GROWTH以外の場合はエラーになる", async () => {
    const taxYearRepo = createFakeTaxYearRepository(createTaxYear());
    const repo = createFakeNisaLifetimeQuotaRepository();

    await expect(
      setNisaLifetimeQuotaCore(taxYearRepo, repo, {
        year: 2025,
        nisaType: "INVALID",
        openingUsedJpy: "1000000",
        soldCostBasisJpy: "0",
      }),
    ).rejects.toThrow("NISA枠区分が不正です");
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it("taxYearを取得・作成し、NISA生涯投資枠をupsertして遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeNisaLifetimeQuotaRepository();

    const result = await setNisaLifetimeQuotaCore(taxYearRepo, repo, {
      year: 2025,
      nisaType: "GROWTH",
      openingUsedJpy: "1000000",
      soldCostBasisJpy: "50000",
    });

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2025);
    expect(repo.upsert).toHaveBeenCalledWith({
      taxYearId: 42,
      nisaType: "GROWTH",
      openingUsedJpy: "1000000",
      soldCostBasisJpy: "50000",
    });
    expect(result).toEqual({
      redirectTo: "/import?year=2025&tab=nisaLifetime",
    });
  });
});

describe("deleteNisaLifetimeQuotaCore", () => {
  it("指定IDを削除し、遷移先を返す", async () => {
    const repo = createFakeNisaLifetimeQuotaRepository();

    const result = await deleteNisaLifetimeQuotaCore(repo, {
      id: 9,
      year: 2024,
    });

    expect(repo.delete).toHaveBeenCalledWith(9);
    expect(result).toEqual({
      redirectTo: "/import?year=2024&tab=nisaLifetime",
    });
  });
});
