import { describe, expect, it, vi } from "vitest";
import type { StockMarginTrade, TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { StockMarginTradeRepository } from "@/lib/repositories/stockMarginTradeRepository";
import { addStockMarginTradeCore, deleteStockMarginTradeCore } from "./stockMarginTrade";

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

function createFakeStockMarginTradeRepository(): StockMarginTradeRepository {
  return {
    findByTaxYearId: vi.fn(async () => []),
    create: vi.fn(async () => ({}) as StockMarginTrade),
    delete: vi.fn(async () => {}),
  };
}

describe("addStockMarginTradeCore", () => {
  it("taxYearを取得・作成し、株式の信用取引を登録して遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeStockMarginTradeRepository();

    const result = await addStockMarginTradeCore(taxYearRepo, repo, {
      year: 2025,
      settledAt: "2025-05-01",
      symbol: "7203",
      realizedPnlJpy: "50000",
      feeJpy: null,
      interestAdjustmentJpy: null,
      broker: "SBI証券",
      memo: null,
    });

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2025);
    expect(repo.create).toHaveBeenCalledWith({
      taxYearId: 42,
      settledAt: new Date("2025-05-01"),
      symbol: "7203",
      realizedPnlJpy: "50000",
      feeJpy: "0",
      interestAdjustmentJpy: "0",
      broker: "SBI証券",
      memo: null,
    });
    expect(result).toEqual({ redirectTo: "/import?year=2025&tab=stockMargin" });
  });

  it("symbolを大文字化し、feeJpy・interestAdjustmentJpy省略時は0を補う", async () => {
    const taxYear = createTaxYear({ id: 1, year: 2024 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeStockMarginTradeRepository();

    await addStockMarginTradeCore(taxYearRepo, repo, {
      year: 2024,
      settledAt: "2024-01-01",
      symbol: "aapl",
      realizedPnlJpy: "-10000",
      feeJpy: "100",
      interestAdjustmentJpy: "50",
      broker: null,
      memo: "メモ",
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "AAPL", feeJpy: "100", interestAdjustmentJpy: "50" }),
    );
  });
});

describe("deleteStockMarginTradeCore", () => {
  it("指定したidの取引を削除して遷移先を返す", async () => {
    const repo = createFakeStockMarginTradeRepository();

    const result = await deleteStockMarginTradeCore(repo, { id: 9, year: 2025 });

    expect(repo.delete).toHaveBeenCalledWith(9);
    expect(result).toEqual({ redirectTo: "/import?year=2025&tab=stockMargin" });
  });
});
