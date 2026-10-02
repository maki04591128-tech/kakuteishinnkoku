import { describe, expect, it, vi } from "vitest";
import type { TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { CasualtyLossCarryforwardRepository } from "@/lib/repositories/casualtyLossCarryforwardRepository";
import {
  deleteCasualtyLossCarryforwardCore,
  setCasualtyLossCarryforwardCore,
} from "./casualtyLossCarryforward";

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

function createFakeCasualtyLossCarryforwardRepository(): CasualtyLossCarryforwardRepository {
  return {
    findByTaxYearId: vi.fn(async () => []),
    upsert: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    createMany: vi.fn(async () => {}),
  };
}

describe("setCasualtyLossCarryforwardCore", () => {
  it("発生年が対象年分より後だとエラーになる", async () => {
    const taxYearRepo = createFakeTaxYearRepository(createTaxYear());
    const repo = createFakeCasualtyLossCarryforwardRepository();

    await expect(
      setCasualtyLossCarryforwardCore(taxYearRepo, repo, {
        year: 2025,
        originYear: 2026,
        remainingAmountJpy: "1000",
      }),
    ).rejects.toThrow("雑損失の発生年は対象年分以前の年である必要があります");
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it("taxYearを取得・作成し、繰越損失をupsertして遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const repo = createFakeCasualtyLossCarryforwardRepository();

    const result = await setCasualtyLossCarryforwardCore(taxYearRepo, repo, {
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
    expect(result).toEqual({ redirectTo: "/import?year=2025&tab=casualtyLossCarryforward" });
  });
});

describe("deleteCasualtyLossCarryforwardCore", () => {
  it("指定IDを削除し、遷移先を返す", async () => {
    const repo = createFakeCasualtyLossCarryforwardRepository();

    const result = await deleteCasualtyLossCarryforwardCore(repo, { id: 9, year: 2024 });

    expect(repo.delete).toHaveBeenCalledWith(9);
    expect(result).toEqual({ redirectTo: "/import?year=2024&tab=casualtyLossCarryforward" });
  });
});
