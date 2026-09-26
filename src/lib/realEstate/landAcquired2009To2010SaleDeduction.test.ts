import { describe, expect, it } from "vitest";
import { simulateLandAcquired2009To2010SaleDeduction } from "./landAcquired2009To2010SaleDeduction";

describe("simulateLandAcquired2009To2010SaleDeduction", () => {
  it("長期譲渡所得で譲渡益が1,000万円を超える場合、1,000万円特別控除後の金額に長期税率(20.315%)を適用する", () => {
    const result = simulateLandAcquired2009To2010SaleDeduction({
      transferPriceJpy: 50_000_000,
      acquisitionCostJpy: 10_000_000,
      transferExpensesJpy: 2_000_000,
      ownershipYears: 15,
      specialDeductionEligible: true,
    });

    expect(result.transferGainJpy.toNumber()).toBe(38_000_000);
    expect(result.holdingPeriodCategory).toBe("LONG_TERM");
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(10_000_000);
    expect(result.taxableGainJpy.toNumber()).toBe(28_000_000);
    expect(result.nationalTaxJpy.toNumber()).toBeCloseTo(4_288_200, 0);
    expect(result.residentTaxJpy.toNumber()).toBe(1_400_000);
    expect(result.totalTaxJpy.toNumber()).toBeCloseTo(5_688_200, 0);
  });

  it("所有期間が5年以下(短期譲渡所得)の場合は要件を満たしていても特別控除を適用しない", () => {
    const result = simulateLandAcquired2009To2010SaleDeduction({
      transferPriceJpy: 50_000_000,
      acquisitionCostJpy: 10_000_000,
      transferExpensesJpy: 2_000_000,
      ownershipYears: 3,
      specialDeductionEligible: true,
    });

    expect(result.holdingPeriodCategory).toBe("SHORT_TERM");
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(0);
    expect(result.taxableGainJpy.toNumber()).toBe(38_000_000);
    expect(result.notes.some((n) => n.includes("短期譲渡所得"))).toBe(true);
  });

  it("所有期間がちょうど5年の場合は短期譲渡所得として扱い特別控除を適用しない", () => {
    const result = simulateLandAcquired2009To2010SaleDeduction({
      transferPriceJpy: 40_000_000,
      acquisitionCostJpy: 5_000_000,
      transferExpensesJpy: 1_000_000,
      ownershipYears: 5,
      specialDeductionEligible: true,
    });

    expect(result.holdingPeriodCategory).toBe("SHORT_TERM");
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(0);
  });

  it("譲渡益が控除限度額(1,000万円)未満なら、譲渡益全額を控除して税額は0円になる", () => {
    const result = simulateLandAcquired2009To2010SaleDeduction({
      transferPriceJpy: 15_000_000,
      acquisitionCostJpy: 5_000_000,
      transferExpensesJpy: 1_000_000,
      ownershipYears: 8,
      specialDeductionEligible: true,
    });

    expect(result.transferGainJpy.toNumber()).toBe(9_000_000);
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(9_000_000);
    expect(result.taxableGainJpy.toNumber()).toBe(0);
    expect(result.totalTaxJpy.toNumber()).toBe(0);
  });

  it("要件を満たさない場合は特別控除を適用せずに試算する", () => {
    const result = simulateLandAcquired2009To2010SaleDeduction({
      transferPriceJpy: 50_000_000,
      acquisitionCostJpy: 10_000_000,
      transferExpensesJpy: 2_000_000,
      ownershipYears: 15,
      specialDeductionEligible: false,
    });

    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(0);
    expect(result.taxableGainJpy.toNumber()).toBe(38_000_000);
    expect(result.notes.some((n) => n.includes("未適用"))).toBe(true);
  });

  it("譲渡損失の場合は税額0円で控除額も0円になる", () => {
    const result = simulateLandAcquired2009To2010SaleDeduction({
      transferPriceJpy: 5_000_000,
      acquisitionCostJpy: 6_000_000,
      transferExpensesJpy: 500_000,
      ownershipYears: 15,
      specialDeductionEligible: true,
    });

    expect(result.transferGainJpy.toNumber()).toBe(-1_500_000);
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(0);
    expect(result.taxableGainJpy.toNumber()).toBe(0);
    expect(result.totalTaxJpy.toNumber()).toBe(0);
  });

  it("取得費不明(0円)で概算取得費を希望する場合は譲渡価額の5%相当額を取得費として採用する", () => {
    const result = simulateLandAcquired2009To2010SaleDeduction({
      transferPriceJpy: 50_000_000,
      acquisitionCostJpy: 0,
      transferExpensesJpy: 2_000_000,
      ownershipYears: 15,
      specialDeductionEligible: true,
      useEstimatedAcquisitionCost: true,
    });

    // 概算取得費 = 50,000,000円 × 5% = 2,500,000円
    expect(result.acquisitionCostJpy.toNumber()).toBe(2_500_000);
    expect(result.estimatedAcquisitionCostApplied).toBe(true);
    expect(result.transferGainJpy.toNumber()).toBe(45_500_000);
    expect(result.notes.some((n) => n.includes("概算取得費の特例"))).toBe(true);
  });

  it("実際の取得費が譲渡価額の5%相当額以上なら、概算取得費を希望しても実際の取得費のまま", () => {
    const result = simulateLandAcquired2009To2010SaleDeduction({
      transferPriceJpy: 50_000_000,
      acquisitionCostJpy: 10_000_000,
      transferExpensesJpy: 2_000_000,
      ownershipYears: 15,
      specialDeductionEligible: true,
      useEstimatedAcquisitionCost: true,
    });

    expect(result.acquisitionCostJpy.toNumber()).toBe(10_000_000);
    expect(result.estimatedAcquisitionCostApplied).toBe(false);
  });

  it("所有期間が負または整数でない場合はエラーになる", () => {
    expect(() =>
      simulateLandAcquired2009To2010SaleDeduction({
        transferPriceJpy: 50_000_000,
        acquisitionCostJpy: 10_000_000,
        transferExpensesJpy: 2_000_000,
        ownershipYears: -1,
        specialDeductionEligible: true,
      }),
    ).toThrow();
    expect(() =>
      simulateLandAcquired2009To2010SaleDeduction({
        transferPriceJpy: 50_000_000,
        acquisitionCostJpy: 10_000_000,
        transferExpensesJpy: 2_000_000,
        ownershipYears: 1.5,
        specialDeductionEligible: true,
      }),
    ).toThrow();
  });

  it("譲渡価額・取得費・譲渡費用が負の場合はエラーになる", () => {
    expect(() =>
      simulateLandAcquired2009To2010SaleDeduction({
        transferPriceJpy: -1,
        acquisitionCostJpy: 0,
        transferExpensesJpy: 0,
        ownershipYears: 15,
        specialDeductionEligible: true,
      }),
    ).toThrow();
  });
});
