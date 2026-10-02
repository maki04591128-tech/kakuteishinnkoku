import { describe, expect, it, vi } from "vitest";
import type { CryptoCostMethod, TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import { setCryptoCostMethodCore } from "./setCryptoCostMethod";

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
    cryptoCostMethod: "AVERAGE" as CryptoCostMethod,
    createdAt: new Date("2025-01-01"),
    ...overrides,
  };
}

describe("setCryptoCostMethodCore", () => {
  it("未対応の評価方法はエラーになる", async () => {
    const repo = createFakeTaxYearRepository(createTaxYear());

    await expect(
      setCryptoCostMethodCore(repo, { year: 2025, cryptoCostMethod: "UNKNOWN", tab: null }),
    ).rejects.toThrow("未対応の評価方法です: UNKNOWN");
    expect(repo.updateCryptoCostMethod).not.toHaveBeenCalled();
  });

  it("tab未指定なら`/`への遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 42, year: 2025 });
    const repo = createFakeTaxYearRepository(taxYear);

    const result = await setCryptoCostMethodCore(repo, {
      year: 2025,
      cryptoCostMethod: "MOVING_AVERAGE",
      tab: null,
    });

    expect(result).toEqual({ redirectTo: "/?year=2025" });
    expect(repo.updateCryptoCostMethod).toHaveBeenCalledWith(42, "MOVING_AVERAGE");
  });

  it("tab指定時は`/import`への遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 7, year: 2024 });
    const repo = createFakeTaxYearRepository(taxYear);

    const result = await setCryptoCostMethodCore(repo, {
      year: 2024,
      cryptoCostMethod: "AVERAGE",
      tab: "crypto",
    });

    expect(result).toEqual({ redirectTo: "/import?year=2024&tab=crypto" });
    expect(repo.updateCryptoCostMethod).toHaveBeenCalledWith(7, "AVERAGE");
  });
});
