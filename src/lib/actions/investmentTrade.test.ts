import { describe, expect, it, vi } from "vitest";
import type { InvestmentTrade, TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { InvestmentTradeRepository } from "@/lib/repositories/investmentTradeRepository";
import { addInvestmentTradeCore, deleteInvestmentTradeCore } from "./investmentTrade";

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

function createFakeInvestmentTradeRepository(): InvestmentTradeRepository {
  return {
    findByTaxYearId: vi.fn(async () => []),
    create: vi.fn(async () => ({}) as InvestmentTrade),
    delete: vi.fn(async () => {}),
  };
}

function baseInput() {
  return {
    year: 2025,
    isNisa: false,
    isListed: true,
    assetType: "STOCK",
    isReit: false,
    mutualFundHighForeignRatio: false,
    mutualFundVeryHighForeignRatio: false,
    tradedAt: "2025-05-01",
    symbol: "1234",
    name: "テスト株式会社",
    type: "BUY",
    quantity: "100",
    unitPriceJpy: "1000",
    feeJpy: null,
    accountType: "SPECIFIC_WITHHOLDING",
    nisaType: null,
    isForeign: false,
    foreignTaxWithheldJpy: null,
    distributionAdjustedForeignTaxJpy: null,
    broker: "SBI証券",
    memo: null,
  };
}

describe("addInvestmentTradeCore", () => {
  it("taxYearを取得・作成し、上場株式等の取引をsource:manualで登録して遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeInvestmentTradeRepository();

    const result = await addInvestmentTradeCore(taxYearRepo, repo, baseInput());

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2025);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        taxYearId: 42,
        tradedAt: new Date("2025-05-01"),
        symbol: "1234",
        feeJpy: "0",
        foreignTaxWithheldJpy: "0",
        distributionAdjustedForeignTaxJpy: "0",
        source: "manual",
      }),
    );
    expect(result).toEqual({ redirectTo: "/import?year=2025&tab=investment" });
  });

  it("feeJpy等を指定した場合はその値をそのまま登録する", async () => {
    const taxYear = createTaxYear({ id: 1, year: 2024 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeInvestmentTradeRepository();

    await addInvestmentTradeCore(taxYearRepo, repo, {
      ...baseInput(),
      year: 2024,
      feeJpy: "50",
      foreignTaxWithheldJpy: "10",
      distributionAdjustedForeignTaxJpy: "5",
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        feeJpy: "50",
        foreignTaxWithheldJpy: "10",
        distributionAdjustedForeignTaxJpy: "5",
      }),
    );
  });

  it("NISA口座かつ非上場株式の場合はエラーになる", async () => {
    const taxYearRepo = createFakeTaxYearRepository(createTaxYear());
    const repo = createFakeInvestmentTradeRepository();

    await expect(
      addInvestmentTradeCore(taxYearRepo, repo, {
        ...baseInput(),
        isNisa: true,
        isListed: false,
      }),
    ).rejects.toThrow("一般株式等(非上場株式)はNISA口座の対象外です");
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("資産種別がETF以外でJ-REIT指定の場合はエラーになる", async () => {
    const taxYearRepo = createFakeTaxYearRepository(createTaxYear());
    const repo = createFakeInvestmentTradeRepository();

    await expect(
      addInvestmentTradeCore(taxYearRepo, repo, {
        ...baseInput(),
        assetType: "STOCK",
        isReit: true,
      }),
    ).rejects.toThrow("J-REITは資産種別「ETF」の場合のみ指定できます");
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("資産種別が投資信託以外で外貨建資産等の組入割合50%超75%以下を指定した場合はエラーになる", async () => {
    const taxYearRepo = createFakeTaxYearRepository(createTaxYear());
    const repo = createFakeInvestmentTradeRepository();

    await expect(
      addInvestmentTradeCore(taxYearRepo, repo, {
        ...baseInput(),
        assetType: "STOCK",
        mutualFundHighForeignRatio: true,
      }),
    ).rejects.toThrow(
      "外貨建資産等の組入割合50%超75%以下は資産種別「投資信託」の場合のみ指定できます",
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("資産種別が投資信託以外で外貨建資産等の組入割合75%超を指定した場合はエラーになる", async () => {
    const taxYearRepo = createFakeTaxYearRepository(createTaxYear());
    const repo = createFakeInvestmentTradeRepository();

    await expect(
      addInvestmentTradeCore(taxYearRepo, repo, {
        ...baseInput(),
        assetType: "STOCK",
        mutualFundVeryHighForeignRatio: true,
      }),
    ).rejects.toThrow(
      "外貨建資産等の組入割合75%超は資産種別「投資信託」の場合のみ指定できます",
    );
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe("deleteInvestmentTradeCore", () => {
  it("指定したidの取引を削除して遷移先を返す", async () => {
    const repo = createFakeInvestmentTradeRepository();

    const result = await deleteInvestmentTradeCore(repo, { id: 9, year: 2025 });

    expect(repo.delete).toHaveBeenCalledWith(9);
    expect(result).toEqual({ redirectTo: "/import?year=2025&tab=investment" });
  });
});
