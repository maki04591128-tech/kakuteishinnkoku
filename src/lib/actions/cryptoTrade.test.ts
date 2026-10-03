import { describe, expect, it, vi } from "vitest";
import type { CryptoTrade, TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { CryptoTradeRepository } from "@/lib/repositories/cryptoTradeRepository";
import { addCryptoTradeCore, deleteCryptoTradeCore } from "./cryptoTrade";

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

function createFakeCryptoTradeRepository(): CryptoTradeRepository {
  return {
    findByTaxYearId: vi.fn(async () => []),
    create: vi.fn(async () => ({}) as CryptoTrade),
    delete: vi.fn(async () => {}),
    importCsvBatch: vi.fn(async () => {}),
  };
}

describe("addCryptoTradeCore", () => {
  it("taxYearを取得・作成し、暗号資産取引をsource:manualで登録して遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeCryptoTradeRepository();

    const result = await addCryptoTradeCore(taxYearRepo, repo, {
      year: 2025,
      tradedAt: "2025-05-01",
      symbol: "btc",
      type: "BUY",
      quantity: "0.5",
      unitPriceJpy: "10000000",
      marketValueUnitPriceJpy: null,
      feeJpy: null,
      exchange: "bitFlyer",
      memo: null,
    });

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2025);
    expect(repo.create).toHaveBeenCalledWith({
      taxYearId: 42,
      tradedAt: new Date("2025-05-01"),
      symbol: "BTC",
      type: "BUY",
      quantity: "0.5",
      unitPriceJpy: "10000000",
      marketValueUnitPriceJpy: null,
      feeJpy: "0",
      exchange: "bitFlyer",
      memo: null,
      source: "manual",
    });
    expect(result).toEqual({ redirectTo: "/import?year=2025&tab=crypto" });
  });

  it("symbolを大文字化し、feeJpy省略時は0を補う", async () => {
    const taxYear = createTaxYear({ id: 1, year: 2024 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeCryptoTradeRepository();

    await addCryptoTradeCore(taxYearRepo, repo, {
      year: 2024,
      tradedAt: "2024-01-01",
      symbol: "eth",
      type: "SELL",
      quantity: "1",
      unitPriceJpy: "300000",
      marketValueUnitPriceJpy: "310000",
      feeJpy: "100",
      exchange: null,
      memo: "メモ",
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "ETH", feeJpy: "100", marketValueUnitPriceJpy: "310000" }),
    );
  });
});

describe("deleteCryptoTradeCore", () => {
  it("指定したidの取引を削除して遷移先を返す", async () => {
    const repo = createFakeCryptoTradeRepository();

    const result = await deleteCryptoTradeCore(repo, { id: 9, year: 2025 });

    expect(repo.delete).toHaveBeenCalledWith(9);
    expect(result).toEqual({ redirectTo: "/import?year=2025&tab=crypto" });
  });
});
