import { describe, expect, it, vi } from "vitest";
import type { CryptoCreditTrade, TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { CryptoCreditTradeRepository } from "@/lib/repositories/cryptoCreditTradeRepository";
import { addCryptoCreditTradeCore, deleteCryptoCreditTradeCore } from "./cryptoCreditTrade";

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

function createFakeCryptoCreditTradeRepository(): CryptoCreditTradeRepository {
  return {
    findByTaxYearId: vi.fn(async () => []),
    create: vi.fn(async () => ({}) as CryptoCreditTrade),
    delete: vi.fn(async () => {}),
  };
}

describe("addCryptoCreditTradeCore", () => {
  it("taxYearを取得・作成し、暗号資産のクレジット取引を登録して遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeCryptoCreditTradeRepository();

    const result = await addCryptoCreditTradeCore(taxYearRepo, repo, {
      year: 2025,
      settledAt: "2025-05-01",
      symbol: "btc",
      realizedPnlJpy: "50000",
      feeJpy: null,
      interestAdjustmentJpy: null,
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
      interestAdjustmentJpy: "0",
      exchange: "bitFlyer",
      memo: null,
    });
    expect(result).toEqual({ redirectTo: "/import?year=2025&tab=cryptoCredit" });
  });

  it("symbolを大文字化し、feeJpy・interestAdjustmentJpy省略時は0を補う", async () => {
    const taxYear = createTaxYear({ id: 1, year: 2024 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeCryptoCreditTradeRepository();

    await addCryptoCreditTradeCore(taxYearRepo, repo, {
      year: 2024,
      settledAt: "2024-01-01",
      symbol: "eth",
      realizedPnlJpy: "-10000",
      feeJpy: "100",
      interestAdjustmentJpy: "50",
      exchange: null,
      memo: "メモ",
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "ETH", feeJpy: "100", interestAdjustmentJpy: "50" }),
    );
  });
});

describe("deleteCryptoCreditTradeCore", () => {
  it("指定したidの取引を削除して遷移先を返す", async () => {
    const repo = createFakeCryptoCreditTradeRepository();

    const result = await deleteCryptoCreditTradeCore(repo, { id: 9, year: 2025 });

    expect(repo.delete).toHaveBeenCalledWith(9);
    expect(result).toEqual({ redirectTo: "/import?year=2025&tab=cryptoCredit" });
  });
});
