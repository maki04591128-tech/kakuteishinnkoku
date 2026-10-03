import { describe, expect, it, vi } from "vitest";
import type { CryptoMarginTrade, TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { CryptoMarginTradeRepository } from "@/lib/repositories/cryptoMarginTradeRepository";
import { addCryptoMarginTradeCore, deleteCryptoMarginTradeCore } from "./cryptoMarginTrade";

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

function createFakeCryptoMarginTradeRepository(): CryptoMarginTradeRepository {
  return {
    findByTaxYearId: vi.fn(async () => []),
    create: vi.fn(async () => ({}) as CryptoMarginTrade),
    delete: vi.fn(async () => {}),
    importCsvBatch: vi.fn(async () => {}),
  };
}

describe("addCryptoMarginTradeCore", () => {
  it("taxYearを取得・作成し、暗号資産の先物・証拠金取引をsource:manualで登録して遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeCryptoMarginTradeRepository();

    const result = await addCryptoMarginTradeCore(taxYearRepo, repo, {
      year: 2025,
      settledAt: "2025-05-01",
      symbol: "btc",
      realizedPnlJpy: "50000",
      feeJpy: null,
      swapJpy: null,
      exchange: "bitFlyer",
      memo: null,
    });

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2025);
    expect(repo.create).toHaveBeenCalledWith({
      taxYearId: 42,
      settledAt: new Date("2025-05-01"),
      symbol: "BTC",
      realizedPnlJpy: "50000",
      feeJpy: "0",
      swapJpy: "0",
      exchange: "bitFlyer",
      memo: null,
      source: "manual",
    });
    expect(result).toEqual({ redirectTo: "/import?year=2025&tab=cryptoMargin" });
  });

  it("symbolを大文字化し、feeJpy・swapJpy省略時は0を補う", async () => {
    const taxYear = createTaxYear({ id: 1, year: 2024 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeCryptoMarginTradeRepository();

    await addCryptoMarginTradeCore(taxYearRepo, repo, {
      year: 2024,
      settledAt: "2024-01-01",
      symbol: "eth",
      realizedPnlJpy: "-10000",
      feeJpy: "100",
      swapJpy: "50",
      exchange: null,
      memo: "メモ",
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "ETH", feeJpy: "100", swapJpy: "50" }),
    );
  });
});

describe("deleteCryptoMarginTradeCore", () => {
  it("指定したidの取引を削除して遷移先を返す", async () => {
    const repo = createFakeCryptoMarginTradeRepository();

    const result = await deleteCryptoMarginTradeCore(repo, { id: 9, year: 2025 });

    expect(repo.delete).toHaveBeenCalledWith(9);
    expect(result).toEqual({ redirectTo: "/import?year=2025&tab=cryptoMargin" });
  });
});
