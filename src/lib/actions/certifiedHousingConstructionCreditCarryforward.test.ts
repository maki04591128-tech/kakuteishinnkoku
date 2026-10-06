import { describe, expect, it, vi } from "vitest";
import type { TaxYear } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { CertifiedHousingConstructionCreditRecordRepository } from "@/lib/repositories/certifiedHousingConstructionCreditRecordRepository";
import type { CertifiedHousingConstructionCreditCarryforwardRepository } from "@/lib/repositories/certifiedHousingConstructionCreditCarryforwardRepository";
import {
  applyCertifiedHousingConstructionCreditCarryforwardCore,
  carryForwardCertifiedHousingConstructionCreditExcessCore,
  deleteCertifiedHousingConstructionCreditCarryforwardCore,
} from "./certifiedHousingConstructionCreditCarryforward";

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

function createFakeCertifiedHousingConstructionCreditRecordRepository(
  existingCreditJpy: string | null = null,
): CertifiedHousingConstructionCreditRecordRepository {
  return {
    findByTaxYearId: vi.fn(async () =>
      existingCreditJpy === null
        ? null
        : ({ creditJpy: { toString: () => existingCreditJpy } } as never),
    ),
    upsert: vi.fn(async () => {}),
    deleteByTaxYearId: vi.fn(async () => {}),
  };
}

function createFakeCertifiedHousingConstructionCreditCarryforwardRepository(
  remainingAmountJpy: string | null = null,
): CertifiedHousingConstructionCreditCarryforwardRepository {
  return {
    findByTaxYearId: vi.fn(async () =>
      remainingAmountJpy === null
        ? null
        : ({ remainingAmountJpy: { toString: () => remainingAmountJpy } } as never),
    ),
    upsert: vi.fn(async () => {}),
    deleteByTaxYearId: vi.fn(async () => {}),
  };
}

describe("carryForwardCertifiedHousingConstructionCreditExcessCore", () => {
  it("翌年のTaxYearを取得・作成し、繰越額をupsertして遷移先を返す", async () => {
    const nextTaxYear = createTaxYear({ id: 42, year: 2026 });
    const taxYearRepo = createFakeTaxYearRepository(nextTaxYear);
    const carryforwardRepo = createFakeCertifiedHousingConstructionCreditCarryforwardRepository();

    const result = await carryForwardCertifiedHousingConstructionCreditExcessCore(
      taxYearRepo,
      carryforwardRepo,
      { year: 2025, remainingAmountJpy: "80000" },
    );

    expect(taxYearRepo.getOrCreateTaxYear).toHaveBeenCalledWith(2026);
    expect(carryforwardRepo.upsert).toHaveBeenCalledWith({
      taxYearId: 42,
      originYear: 2025,
      remainingAmountJpy: "80000",
    });
    expect(result).toEqual({
      redirectTo: "/certified-housing-construction-credit?year=2025&carryforwardSaved=1",
    });
  });
});

describe("applyCertifiedHousingConstructionCreditCarryforwardCore", () => {
  it("繰越が登録済みの場合、既存の登録額に加算してupsertし繰越を削除する", async () => {
    const taxYear = createTaxYear({ id: 7, year: 2026 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const recordRepo = createFakeCertifiedHousingConstructionCreditRecordRepository("100000");
    const carryforwardRepo =
      createFakeCertifiedHousingConstructionCreditCarryforwardRepository("80000");

    const result = await applyCertifiedHousingConstructionCreditCarryforwardCore(
      taxYearRepo,
      recordRepo,
      carryforwardRepo,
      { year: 2026 },
    );

    expect(recordRepo.upsert).toHaveBeenCalledWith({ taxYearId: 7, creditJpy: "180000" });
    expect(carryforwardRepo.deleteByTaxYearId).toHaveBeenCalledWith(7);
    expect(result).toEqual({
      redirectTo: "/certified-housing-construction-credit?year=2026&carryforwardApplied=1",
    });
  });

  it("既存の登録が無い場合、繰越額のみをupsertする", async () => {
    const taxYear = createTaxYear({ id: 7, year: 2026 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const recordRepo = createFakeCertifiedHousingConstructionCreditRecordRepository(null);
    const carryforwardRepo =
      createFakeCertifiedHousingConstructionCreditCarryforwardRepository("80000");

    await applyCertifiedHousingConstructionCreditCarryforwardCore(
      taxYearRepo,
      recordRepo,
      carryforwardRepo,
      { year: 2026 },
    );

    expect(recordRepo.upsert).toHaveBeenCalledWith({ taxYearId: 7, creditJpy: "80000" });
  });

  it("繰越が登録されていない場合、何もせず遷移先のみ返す", async () => {
    const taxYear = createTaxYear({ id: 7, year: 2026 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const recordRepo = createFakeCertifiedHousingConstructionCreditRecordRepository(null);
    const carryforwardRepo = createFakeCertifiedHousingConstructionCreditCarryforwardRepository(null);

    const result = await applyCertifiedHousingConstructionCreditCarryforwardCore(
      taxYearRepo,
      recordRepo,
      carryforwardRepo,
      { year: 2026 },
    );

    expect(recordRepo.upsert).not.toHaveBeenCalled();
    expect(carryforwardRepo.deleteByTaxYearId).not.toHaveBeenCalled();
    expect(result).toEqual({
      redirectTo: "/certified-housing-construction-credit?year=2026&carryforwardApplied=1",
    });
  });

  it("対象年のTaxYearが存在しない場合、何もせず遷移先のみ返す", async () => {
    const taxYearRepo = createFakeTaxYearRepository(null);
    const recordRepo = createFakeCertifiedHousingConstructionCreditRecordRepository(null);
    const carryforwardRepo =
      createFakeCertifiedHousingConstructionCreditCarryforwardRepository("80000");

    const result = await applyCertifiedHousingConstructionCreditCarryforwardCore(
      taxYearRepo,
      recordRepo,
      carryforwardRepo,
      { year: 2026 },
    );

    expect(carryforwardRepo.findByTaxYearId).not.toHaveBeenCalled();
    expect(result).toEqual({
      redirectTo: "/certified-housing-construction-credit?year=2026&carryforwardApplied=1",
    });
  });
});

describe("deleteCertifiedHousingConstructionCreditCarryforwardCore", () => {
  it("対象年のTaxYearが存在する場合、taxYearIdで繰越を削除して遷移先を返す", async () => {
    const taxYear = createTaxYear({ id: 9, year: 2025 });
    const taxYearRepo = createFakeTaxYearRepository(taxYear);
    const carryforwardRepo = createFakeCertifiedHousingConstructionCreditCarryforwardRepository();

    const result = await deleteCertifiedHousingConstructionCreditCarryforwardCore(
      taxYearRepo,
      carryforwardRepo,
      { year: 2025 },
    );

    expect(carryforwardRepo.deleteByTaxYearId).toHaveBeenCalledWith(9);
    expect(result).toEqual({
      redirectTo: "/certified-housing-construction-credit?year=2025&carryforwardDeleted=1",
    });
  });

  it("対象年のTaxYearが存在しない場合、削除を呼ばずに遷移先のみ返す", async () => {
    const taxYearRepo = createFakeTaxYearRepository(null);
    const carryforwardRepo = createFakeCertifiedHousingConstructionCreditCarryforwardRepository();

    const result = await deleteCertifiedHousingConstructionCreditCarryforwardCore(
      taxYearRepo,
      carryforwardRepo,
      { year: 2023 },
    );

    expect(carryforwardRepo.deleteByTaxYearId).not.toHaveBeenCalled();
    expect(result).toEqual({
      redirectTo: "/certified-housing-construction-credit?year=2023&carryforwardDeleted=1",
    });
  });
});
