import { describe, expect, it, vi } from "vitest";
import type { TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { BrokerAnnualReportRepository } from "@/lib/repositories/brokerAnnualReportRepository";
import {
  deleteBrokerAnnualReportCore,
  setBrokerAnnualReportCore,
} from "./brokerAnnualReport";

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

function createFakeBrokerAnnualReportRepository(): BrokerAnnualReportRepository {
  return {
    findByTaxYearId: vi.fn(async () => []),
    upsert: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    upsertMany: vi.fn(async () => {}),
  };
}

describe("setBrokerAnnualReportCore", () => {
  it("taxYearを取得・作成し、特定口座年間取引報告書をupsertして遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeBrokerAnnualReportRepository();

    const result = await setBrokerAnnualReportCore(taxYearRepo, repo, {
      year: 2025,
      broker: "SBI証券",
      accountType: "SPECIFIC_WITHHOLDING",
      proceedsJpy: "1000000",
      acquisitionCostJpy: "800000",
      dividendJpy: "5000",
    });

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2025);
    expect(repo.upsert).toHaveBeenCalledWith({
      taxYearId: 42,
      broker: "SBI証券",
      accountType: "SPECIFIC_WITHHOLDING",
      proceedsJpy: "1000000",
      acquisitionCostJpy: "800000",
      dividendJpy: "5000",
    });
    expect(result).toEqual({
      redirectTo: "/import?year=2025&tab=brokerReport",
    });
  });
});

describe("deleteBrokerAnnualReportCore", () => {
  it("指定IDを削除し、遷移先を返す", async () => {
    const repo = createFakeBrokerAnnualReportRepository();

    const result = await deleteBrokerAnnualReportCore(repo, {
      id: 9,
      year: 2024,
    });

    expect(repo.delete).toHaveBeenCalledWith(9);
    expect(result).toEqual({
      redirectTo: "/import?year=2024&tab=brokerReport",
    });
  });
});
