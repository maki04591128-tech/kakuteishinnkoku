import { describe, expect, it, vi } from "vitest";
import type { TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { CryptoMarginTradeRepository } from "@/lib/repositories/cryptoMarginTradeRepository";
import { importCryptoMarginCsvCore } from "./importCryptoMarginCsv";

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

function createFakeCryptoMarginTradeRepository(): CryptoMarginTradeRepository {
  return {
    findByTaxYearId: vi.fn(async () => []),
    create: vi.fn(async () => ({}) as never),
    delete: vi.fn(async () => {}),
    importCsvBatch: vi.fn(async () => {}),
  };
}

const HEADER = "決済日時,銘柄,決済損益,手数料,スワップ";

describe("importCryptoMarginCsvCore", () => {
  it("マッピングに従ってCSVを取り込み、取引所名を付与する", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeCryptoMarginTradeRepository();

    const csvText = [HEADER, "2024/03/01 10:00:00,BTCJPY,-5000,100,-50"].join("\n");

    const result = await importCryptoMarginCsvCore(taxYearRepo, repo, {
      year: 2025,
      csvText,
      fileName: "margin.csv",
      exchangeName: "DMM Bitcoin",
      mapping: {
        dateColumn: "決済日時",
        symbolColumn: "銘柄",
        pnlColumn: "決済損益",
        feeColumn: "手数料",
        swapColumn: "スワップ",
      },
    });

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2025);
    expect(repo.importCsvBatch).toHaveBeenCalledWith({
      taxYearId: 42,
      sourceType: "crypto_margin_csv",
      fileName: "margin.csv",
      rows: [
        {
          settledAt: new Date("2024/03/01 10:00:00"),
          symbol: "BTCJPY",
          realizedPnlJpy: "-5000",
          feeJpy: "100",
          swapJpy: "-50",
          exchange: "DMM Bitcoin",
          source: "crypto_margin_csv:manual",
        },
      ],
    });
    expect(result).toEqual({
      importedRowCount: 1,
      skippedRowCount: 0,
      redirectTo: "/import?year=2025&tab=cryptoMargin&imported=1",
    });
  });

  it("取引所名が未指定の場合はnullを渡す", async () => {
    const taxYear = createTaxYear({ id: 7, year: 2024 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeCryptoMarginTradeRepository();

    const csvText = [HEADER, "2024/01/10 12:00:00,ETHJPY,3000,,"].join("\n");

    await importCryptoMarginCsvCore(taxYearRepo, repo, {
      year: 2024,
      csvText,
      fileName: "margin2.csv",
      exchangeName: null,
      mapping: {
        dateColumn: "決済日時",
        symbolColumn: "銘柄",
        pnlColumn: "決済損益",
      },
    });

    expect(repo.importCsvBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [expect.objectContaining({ exchange: null })],
      }),
    );
  });

  it("必須項目が欠けた行はスキップし、遷移先にskippedを含める", async () => {
    const taxYear = createTaxYear({ id: 1, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeCryptoMarginTradeRepository();

    const csvText = [
      HEADER,
      "2024/03/01 10:00:00,BTCJPY,-5000,100,-50",
      ",ETHJPY,3000,,",
    ].join("\n");

    const result = await importCryptoMarginCsvCore(taxYearRepo, repo, {
      year: 2025,
      csvText,
      fileName: "margin.csv",
      exchangeName: null,
      mapping: {
        dateColumn: "決済日時",
        symbolColumn: "銘柄",
        pnlColumn: "決済損益",
      },
    });

    expect(result).toEqual({
      importedRowCount: 1,
      skippedRowCount: 1,
      redirectTo: "/import?year=2025&tab=cryptoMargin&imported=1&skipped=1",
    });
  });
});
