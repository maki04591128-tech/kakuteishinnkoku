import { describe, expect, it, vi } from "vitest";
import type { TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { BrokerAnnualReportRepository } from "@/lib/repositories/brokerAnnualReportRepository";
import { importBrokerAnnualReportCsvCore } from "./importBrokerAnnualReportCsv";

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

describe("importBrokerAnnualReportCsvCore", () => {
  it("CSVを解析してインポートし、スキップ無しの場合の遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeBrokerAnnualReportRepository();

    const csvText = [
      "証券会社,口座区分,譲渡の対価の額,取得費及び譲渡費用の額等,配当等の額",
      "SBI証券,特定口座(源泉徴収あり),1000000,800000,5000",
      "楽天証券,一般口座,2000000,1500000,0",
    ].join("\n");

    const result = await importBrokerAnnualReportCsvCore(taxYearRepo, repo, {
      year: 2025,
      csvText,
      mapping: {
        brokerColumn: "証券会社",
        accountTypeColumn: "口座区分",
        proceedsColumn: "譲渡の対価の額",
        acquisitionCostColumn: "取得費及び譲渡費用の額等",
        dividendColumn: "配当等の額",
      },
    });

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2025);
    expect(repo.upsertMany).toHaveBeenCalledWith([
      {
        taxYearId: 42,
        broker: "SBI証券",
        accountType: "SPECIFIC_WITHHOLDING",
        proceedsJpy: "1000000",
        acquisitionCostJpy: "800000",
        dividendJpy: "5000",
      },
      {
        taxYearId: 42,
        broker: "楽天証券",
        accountType: "GENERAL",
        proceedsJpy: "2000000",
        acquisitionCostJpy: "1500000",
        dividendJpy: "0",
      },
    ]);
    expect(result).toEqual({
      importedRowCount: 2,
      skippedRowCount: 0,
      redirectTo: "/import?year=2025&tab=brokerReport&imported=2",
    });
  });

  it("必須項目が空の行はスキップし、遷移先にskippedを含める", async () => {
    const taxYear = createTaxYear({ id: 7, year: 2024 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeBrokerAnnualReportRepository();

    const csvText = [
      "証券会社,口座区分,譲渡の対価の額,取得費及び譲渡費用の額等",
      "SBI証券,特定口座(源泉徴収あり),1000000,800000",
      ",,,",
    ].join("\n");

    const result = await importBrokerAnnualReportCsvCore(taxYearRepo, repo, {
      year: 2024,
      csvText,
      mapping: {
        brokerColumn: "証券会社",
        accountTypeColumn: "口座区分",
        proceedsColumn: "譲渡の対価の額",
        acquisitionCostColumn: "取得費及び譲渡費用の額等",
      },
    });

    expect(result).toEqual({
      importedRowCount: 1,
      skippedRowCount: 1,
      redirectTo: "/import?year=2024&tab=brokerReport&imported=1&skipped=1",
    });
  });
});
