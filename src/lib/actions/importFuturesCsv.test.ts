import { describe, expect, it, vi } from "vitest";
import type { FuturesTrade, TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { FuturesTradeRepository } from "@/lib/repositories/futuresTradeRepository";
import { importFuturesCsvCore } from "./importFuturesCsv";

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

function createFakeFuturesTradeRepository(): FuturesTradeRepository {
  return {
    findByTaxYearId: vi.fn(async () => []),
    create: vi.fn(async () => ({}) as FuturesTrade),
    delete: vi.fn(async () => {}),
    importCsvBatch: vi.fn(async () => {}),
  };
}

const HEADER = "決済日時,通貨ペア,損益,手数料,スワップ";

describe("importFuturesCsvCore", () => {
  it("マッピングに従ってCSVを取り込み、ブローカー名を付与する", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeFuturesTradeRepository();

    const csvText = [HEADER, "2026/1/10 10:00:00,USD/JPY,100000,500,-100"].join("\n");

    const result = await importFuturesCsvCore(taxYearRepo, repo, {
      year: 2025,
      csvText,
      fileName: "futures.csv",
      brokerLabel: "GMOクリック証券",
      mapping: {
        dateColumn: "決済日時",
        symbolColumn: "通貨ペア",
        pnlColumn: "損益",
        feeColumn: "手数料",
        swapColumn: "スワップ",
      },
    });

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2025);
    expect(repo.importCsvBatch).toHaveBeenCalledWith({
      taxYearId: 42,
      sourceType: "futures_csv",
      fileName: "futures.csv",
      rows: [
        {
          settledAt: new Date("2026/1/10 10:00:00"),
          symbol: "USD/JPY",
          realizedPnlJpy: "100000",
          feeJpy: "500",
          swapJpy: "-100",
          broker: "GMOクリック証券",
          source: "futures_csv:manual",
        },
      ],
    });
    expect(result).toEqual({
      importedRowCount: 1,
      skippedRowCount: 0,
      redirectTo: "/import?year=2025&tab=futures&imported=1",
    });
  });

  it("ブローカー名が未指定の場合はnullを渡す", async () => {
    const taxYear = createTaxYear({ id: 7, year: 2024 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeFuturesTradeRepository();

    const csvText = [HEADER, "2026/3/5 12:30:00,EUR/JPY,-30000,,"].join("\n");

    await importFuturesCsvCore(taxYearRepo, repo, {
      year: 2024,
      csvText,
      fileName: "futures2.csv",
      brokerLabel: null,
      mapping: {
        dateColumn: "決済日時",
        symbolColumn: "通貨ペア",
        pnlColumn: "損益",
      },
    });

    expect(repo.importCsvBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [expect.objectContaining({ broker: null })],
      }),
    );
  });

  it("必須項目が欠けた行はスキップし、遷移先にskippedを含める", async () => {
    const taxYear = createTaxYear({ id: 1, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeFuturesTradeRepository();

    const csvText = [
      HEADER,
      "2026/1/10 10:00:00,USD/JPY,100000,500,-100",
      ",EUR/JPY,-30000,,",
    ].join("\n");

    const result = await importFuturesCsvCore(taxYearRepo, repo, {
      year: 2025,
      csvText,
      fileName: "futures.csv",
      brokerLabel: null,
      mapping: {
        dateColumn: "決済日時",
        symbolColumn: "通貨ペア",
        pnlColumn: "損益",
      },
    });

    expect(result).toEqual({
      importedRowCount: 1,
      skippedRowCount: 1,
      redirectTo: "/import?year=2025&tab=futures&imported=1&skipped=1",
    });
  });
});
