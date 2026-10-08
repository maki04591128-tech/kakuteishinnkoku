import { describe, expect, it, vi } from "vitest";
import type { TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { CashflowEntryRepository } from "@/lib/repositories/cashflowEntryRepository";
import { importMoneyForwardCsvCore } from "./importMoneyForwardCsv";

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

function createFakeCashflowEntryRepository(): CashflowEntryRepository {
  return {
    importMoneyForwardCsv: vi.fn(async () => {}),
  };
}

const HEADER = "計算対象,日付,内容,金額（円）,保有金融機関,大項目,中項目,メモ,振替,ID";

describe("importMoneyForwardCsvCore", () => {
  it("MoneyForward家計簿CSVを取り込む", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeCashflowEntryRepository();

    const csvText = [
      HEADER,
      "1,2026/1/15,スーパーでの買い物,-3500,楽天カード,食費,食料品,,0,abc123",
    ].join("\n");

    const result = await importMoneyForwardCsvCore(taxYearRepo, repo, {
      year: 2025,
      csvText,
      fileName: "cashflow.csv",
    });

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2025);
    expect(repo.importMoneyForwardCsv).toHaveBeenCalledWith({
      taxYearId: 42,
      fileName: "cashflow.csv",
      rows: [
        {
          date: new Date("2026/1/15"),
          content: "スーパーでの買い物",
          amountJpy: "-3500",
          direction: "EXPENSE",
          largeCategory: "食費",
          middleCategory: "食料品",
          institution: "楽天カード",
          memo: null,
          isCalculationTarget: true,
        },
      ],
    });
    expect(result).toEqual({
      importedRowCount: 1,
      skippedRowCount: 0,
      redirectTo: "/import?year=2025&imported=1",
    });
  });

  it("必須項目が欠けた行はスキップし、遷移先にskippedを含める", async () => {
    const taxYear = createTaxYear({ id: 1, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeCashflowEntryRepository();

    const csvText = [
      HEADER,
      "1,2026/1/15,スーパーでの買い物,-3500,楽天カード,食費,食料品,,0,abc123",
      "1,,内容無し,,,,,,,abc124",
    ].join("\n");

    const result = await importMoneyForwardCsvCore(taxYearRepo, repo, {
      year: 2025,
      csvText,
      fileName: "cashflow.csv",
    });

    expect(result).toEqual({
      importedRowCount: 1,
      skippedRowCount: 1,
      redirectTo: "/import?year=2025&imported=1&skipped=1",
    });
  });
});
