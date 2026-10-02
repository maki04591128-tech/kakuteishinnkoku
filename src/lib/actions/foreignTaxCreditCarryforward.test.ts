import { describe, expect, it, vi } from "vitest";
import type { TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { ForeignTaxCreditCarryforwardRepository } from "@/lib/repositories/foreignTaxCreditCarryforwardRepository";
import {
  deleteForeignTaxCreditCarryforwardCore,
  setForeignTaxCreditCarryforwardCore,
} from "./foreignTaxCreditCarryforward";

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

function createFakeForeignTaxCreditCarryforwardRepository(): ForeignTaxCreditCarryforwardRepository {
  return {
    findByTaxYearId: vi.fn(async () => []),
    upsert: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    createMany: vi.fn(async () => {}),
  };
}

describe("setForeignTaxCreditCarryforwardCore", () => {
  it("発生年が対象年分より後だとエラーになる", async () => {
    const taxYearRepo = createFakeTaxYearRepository(createTaxYear());
    const repo = createFakeForeignTaxCreditCarryforwardRepository();

    await expect(
      setForeignTaxCreditCarryforwardCore(taxYearRepo, repo, {
        year: 2025,
        originYear: 2026,
        remainingAmountJpy: "1000",
      }),
    ).rejects.toThrow("控除限度超過額の発生年は対象年分以前の年である必要があります");
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it("taxYearを取得・作成し、繰越控除限度超過額をupsertして遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeForeignTaxCreditCarryforwardRepository();

    const result = await setForeignTaxCreditCarryforwardCore(taxYearRepo, repo, {
      year: 2025,
      originYear: 2023,
      remainingAmountJpy: "50000",
    });

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2025);
    expect(repo.upsert).toHaveBeenCalledWith({
      taxYearId: 42,
      originYear: 2023,
      remainingAmountJpy: "50000",
    });
    expect(result).toEqual({
      redirectTo: "/import?year=2025&tab=foreignTaxCredit",
    });
  });
});

describe("deleteForeignTaxCreditCarryforwardCore", () => {
  it("指定IDを削除し、遷移先を返す", async () => {
    const repo = createFakeForeignTaxCreditCarryforwardRepository();

    const result = await deleteForeignTaxCreditCarryforwardCore(repo, { id: 9, year: 2024 });

    expect(repo.delete).toHaveBeenCalledWith(9);
    expect(result).toEqual({
      redirectTo: "/import?year=2024&tab=foreignTaxCredit",
    });
  });
});
