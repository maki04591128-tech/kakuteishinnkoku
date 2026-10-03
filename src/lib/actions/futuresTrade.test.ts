import { describe, expect, it, vi } from "vitest";
import type { FuturesTrade, TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { FuturesTradeRepository } from "@/lib/repositories/futuresTradeRepository";
import { addFuturesTradeCore, deleteFuturesTradeCore } from "./futuresTrade";

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

function createFakeFuturesTradeRepository(): FuturesTradeRepository {
  return {
    findByTaxYearId: vi.fn(async () => []),
    create: vi.fn(async () => ({}) as FuturesTrade),
    delete: vi.fn(async () => {}),
    importCsvBatch: vi.fn(async () => {}),
  };
}

describe("addFuturesTradeCore", () => {
  it("taxYearを取得・作成し、先物取引を登録して遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeFuturesTradeRepository();

    const result = await addFuturesTradeCore(taxYearRepo, repo, {
      year: 2025,
      settledAt: "2025-05-01",
      symbol: "日経225",
      realizedPnlJpy: "50000",
      feeJpy: null,
      swapJpy: null,
      broker: "SBI証券",
      memo: null,
    });

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2025);
    expect(repo.create).toHaveBeenCalledWith({
      taxYearId: 42,
      settledAt: new Date("2025-05-01"),
      symbol: "日経225",
      realizedPnlJpy: "50000",
      feeJpy: "0",
      swapJpy: "0",
      broker: "SBI証券",
      memo: null,
      source: "manual",
    });
    expect(result).toEqual({ redirectTo: "/import?year=2025&tab=futures" });
  });

  it("feeJpy・swapJpy省略時は0を補う", async () => {
    const taxYear = createTaxYear({ id: 1, year: 2024 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeFuturesTradeRepository();

    await addFuturesTradeCore(taxYearRepo, repo, {
      year: 2024,
      settledAt: "2024-01-01",
      symbol: "TOPIX",
      realizedPnlJpy: "-10000",
      feeJpy: "100",
      swapJpy: "50",
      broker: null,
      memo: "メモ",
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ feeJpy: "100", swapJpy: "50", source: "manual" }),
    );
  });
});

describe("deleteFuturesTradeCore", () => {
  it("指定したidの取引を削除して遷移先を返す", async () => {
    const repo = createFakeFuturesTradeRepository();

    const result = await deleteFuturesTradeCore(repo, { id: 9, year: 2025 });

    expect(repo.delete).toHaveBeenCalledWith(9);
    expect(result).toEqual({ redirectTo: "/import?year=2025&tab=futures" });
  });
});
