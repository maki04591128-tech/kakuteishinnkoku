import { describe, expect, it, vi } from "vitest";
import type { TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { CryptoTradeRepository } from "@/lib/repositories/cryptoTradeRepository";
import { importCryptoExchangeCsvCore } from "./importCryptoExchangeCsv";

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

function createFakeCryptoTradeRepository(): CryptoTradeRepository {
  return {
    findByTaxYearId: vi.fn(async () => []),
    create: vi.fn(async () => ({}) as never),
    delete: vi.fn(async () => {}),
    importCsvBatch: vi.fn(async () => {}),
  };
}

const BITFLYER_HEADER =
  "取引日時,通貨,取引種別,取引価格,通貨1,通貨1数量,手数料,通貨1の対円レート,通貨2,通貨2数量,自己・媒介,注文ID,備考";

describe("importCryptoExchangeCsvCore", () => {
  it("presetによる自動解析でCSVを取り込み、取引所未指定なら既定ラベルを付与する", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeCryptoTradeRepository();

    const csvText = [
      BITFLYER_HEADER,
      "2024/03/01 10:00:00,BTC_JPY,買い,5000000,BTC,0.1,0,5000000,JPY,500000,媒介,ORDER1,",
    ].join("\n");

    const result = await importCryptoExchangeCsvCore(taxYearRepo, repo, {
      year: 2025,
      csvText,
      fileName: "bitflyer.csv",
      preset: "bitflyer",
      exchangeName: null,
    });

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2025);
    expect(repo.importCsvBatch).toHaveBeenCalledWith({
      taxYearId: 42,
      sourceType: "crypto_csv_bitflyer",
      fileName: "bitflyer.csv",
      rows: [
        expect.objectContaining({
          symbol: "BTC",
          type: "BUY",
          quantity: "0.1",
          unitPriceJpy: "5000000",
          feeJpy: "0",
          exchange: "bitFlyer",
          source: "exchange_csv:bitflyer",
        }),
      ],
    });
    expect(result).toEqual({
      importedRowCount: 1,
      skippedRowCount: 0,
      redirectTo: "/import?year=2025&tab=crypto&imported=1",
    });
  });

  it("手動マッピング指定時はmappingで解析し、取引所名を上書きできる", async () => {
    const taxYear = createTaxYear({ id: 7, year: 2024 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeCryptoTradeRepository();

    const csvText = [
      "id,time,operation,amount,trading_currency,price,original_currency,fee,comment",
      "1,2026/1/10 10:00:00,buy,0.1,BTC,5000000,JPY,0,",
      "2,2026/3/5 12:30:00,sell,0.05,BTC,6000000,JPY,0,",
    ].join("\n");

    const result = await importCryptoExchangeCsvCore(taxYearRepo, repo, {
      year: 2024,
      csvText,
      fileName: "manual.csv",
      preset: "other",
      exchangeName: "My Exchange",
      mapping: {
        dateColumn: "time",
        symbolColumn: "trading_currency",
        typeColumn: "operation",
        buyValue: "buy",
        sellValue: "sell",
        quantityColumn: "amount",
        unitPriceColumn: "price",
        feeColumn: "fee",
      },
    });

    expect(repo.importCsvBatch).toHaveBeenCalledWith({
      taxYearId: 7,
      sourceType: "crypto_csv_other",
      fileName: "manual.csv",
      rows: [
        expect.objectContaining({ exchange: "My Exchange", source: "exchange_csv:other:manual" }),
        expect.objectContaining({ exchange: "My Exchange", source: "exchange_csv:other:manual" }),
      ],
    });
    expect(result).toEqual({
      importedRowCount: 2,
      skippedRowCount: 0,
      redirectTo: "/import?year=2024&tab=crypto&imported=2",
    });
  });

  it("対象外の行はスキップし、遷移先にskippedを含める", async () => {
    const taxYear = createTaxYear({ id: 1, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeCryptoTradeRepository();

    const csvText = [
      BITFLYER_HEADER,
      "2024/03/01 10:00:00,BTC_JPY,買い,5000000,BTC,0.1,0,5000000,JPY,500000,媒介,ORDER1,",
      "2024/03/02 10:00:00,BTC,入金,0,BTC,0.1,0,5000000,JPY,0,,ORDER3,",
    ].join("\n");

    const result = await importCryptoExchangeCsvCore(taxYearRepo, repo, {
      year: 2025,
      csvText,
      fileName: "bitflyer.csv",
      preset: "bitflyer",
      exchangeName: null,
    });

    expect(result).toEqual({
      importedRowCount: 1,
      skippedRowCount: 1,
      redirectTo: "/import?year=2025&tab=crypto&imported=1&skipped=1",
    });
  });
});
