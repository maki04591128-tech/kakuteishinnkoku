import { describe, expect, it } from "vitest";
import { simulateHomeSaleTax } from "./homeSaleTaxSimulation";

describe("simulateHomeSaleTax", () => {
  it("短期譲渡所得(所有期間5年以下)は税率39.63%で計算する", () => {
    const result = simulateHomeSaleTax({
      transferPriceJpy: 50_000_000,
      acquisitionCostJpy: 20_000_000,
      transferExpensesJpy: 1_000_000,
      ownershipYears: 3,
      specialDeductionEligible: false,
      reducedRateEligible: false,
    });

    expect(result.holdingPeriodCategory).toBe("SHORT_TERM");
    expect(result.transferGainJpy.toNumber()).toBe(29_000_000);
    expect(result.taxableGainJpy.toNumber()).toBe(29_000_000);
    expect(result.nationalTaxJpy.toNumber()).toBeCloseTo(8_882_700, 0);
    expect(result.residentTaxJpy.toNumber()).toBe(2_610_000);
    expect(result.totalTaxJpy.toNumber()).toBeCloseTo(11_492_700, 0);
  });

  it("長期譲渡所得は3,000万円特別控除を適用したうえで税率20.315%で計算する", () => {
    const result = simulateHomeSaleTax({
      transferPriceJpy: 60_000_000,
      acquisitionCostJpy: 10_000_000,
      transferExpensesJpy: 2_000_000,
      ownershipYears: 8,
      specialDeductionEligible: true,
      reducedRateEligible: true,
    });

    expect(result.holdingPeriodCategory).toBe("LONG_TERM");
    expect(result.transferGainJpy.toNumber()).toBe(48_000_000);
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(30_000_000);
    expect(result.taxableGainJpy.toNumber()).toBe(18_000_000);
    // 所有期間が10年を超えないため軽減税率の特例は適用されない
    expect(result.reducedRateApplied).toBe(false);
    expect(result.nationalTaxJpy.toNumber()).toBeCloseTo(2_756_700, 0);
    expect(result.residentTaxJpy.toNumber()).toBe(900_000);
    expect(result.totalTaxJpy.toNumber()).toBeCloseTo(3_656_700, 0);
    expect(result.notes.some((n) => n.includes("10年を超える場合のみ"))).toBe(true);
  });

  it("所有期間10年超は軽減税率の特例により6,000万円以下・超の部分で税率を分けて計算する", () => {
    const result = simulateHomeSaleTax({
      transferPriceJpy: 150_000_000,
      acquisitionCostJpy: 20_000_000,
      transferExpensesJpy: 3_000_000,
      ownershipYears: 15,
      specialDeductionEligible: true,
      reducedRateEligible: true,
    });

    expect(result.transferGainJpy.toNumber()).toBe(127_000_000);
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(30_000_000);
    expect(result.taxableGainJpy.toNumber()).toBe(97_000_000);
    expect(result.reducedRateApplied).toBe(true);
    expect(result.portions).toHaveLength(2);
    expect(result.portions[0].taxableGainJpy.toNumber()).toBe(60_000_000);
    expect(result.portions[1].taxableGainJpy.toNumber()).toBe(37_000_000);
    expect(result.nationalTaxJpy.toNumber()).toBeCloseTo(11_792_550, 0);
    expect(result.residentTaxJpy.toNumber()).toBe(4_250_000);
    expect(result.totalTaxJpy.toNumber()).toBeCloseTo(16_042_550, 0);
  });

  it("所有期間がちょうど10年の場合は軽減税率の特例の対象外(10年超が要件)", () => {
    const result = simulateHomeSaleTax({
      transferPriceJpy: 100_000_000,
      acquisitionCostJpy: 10_000_000,
      transferExpensesJpy: 0,
      ownershipYears: 10,
      specialDeductionEligible: false,
      reducedRateEligible: true,
    });

    expect(result.holdingPeriodCategory).toBe("LONG_TERM");
    expect(result.reducedRateApplied).toBe(false);
  });

  it("譲渡損失の場合は税額0円で、特別控除・軽減税率は適用しない", () => {
    const result = simulateHomeSaleTax({
      transferPriceJpy: 10_000_000,
      acquisitionCostJpy: 15_000_000,
      transferExpensesJpy: 500_000,
      ownershipYears: 6,
      specialDeductionEligible: true,
      reducedRateEligible: true,
    });

    expect(result.transferGainJpy.toNumber()).toBe(-5_500_000);
    expect(result.taxableGainJpy.toNumber()).toBe(0);
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(0);
    expect(result.totalTaxJpy.toNumber()).toBe(0);
    expect(result.portions).toHaveLength(0);
  });

  it("3,000万円を超える特別控除は適用されない(上限で切り詰める)", () => {
    const result = simulateHomeSaleTax({
      transferPriceJpy: 35_000_000,
      acquisitionCostJpy: 2_000_000,
      transferExpensesJpy: 0,
      ownershipYears: 20,
      specialDeductionEligible: true,
      reducedRateEligible: false,
    });

    expect(result.transferGainJpy.toNumber()).toBe(33_000_000);
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(30_000_000);
    expect(result.taxableGainJpy.toNumber()).toBe(3_000_000);
  });

  it("負の値は拒否する", () => {
    expect(() =>
      simulateHomeSaleTax({
        transferPriceJpy: -1,
        acquisitionCostJpy: 0,
        transferExpensesJpy: 0,
        ownershipYears: 1,
        specialDeductionEligible: false,
        reducedRateEligible: false,
      }),
    ).toThrow();
    expect(() =>
      simulateHomeSaleTax({
        transferPriceJpy: 100,
        acquisitionCostJpy: -1,
        transferExpensesJpy: 0,
        ownershipYears: 1,
        specialDeductionEligible: false,
        reducedRateEligible: false,
      }),
    ).toThrow();
  });

  it("所有期間が負の値・非整数の場合は拒否する", () => {
    expect(() =>
      simulateHomeSaleTax({
        transferPriceJpy: 100,
        acquisitionCostJpy: 0,
        transferExpensesJpy: 0,
        ownershipYears: -1,
        specialDeductionEligible: false,
        reducedRateEligible: false,
      }),
    ).toThrow();
    expect(() =>
      simulateHomeSaleTax({
        transferPriceJpy: 100,
        acquisitionCostJpy: 0,
        transferExpensesJpy: 0,
        ownershipYears: 5.5,
        specialDeductionEligible: false,
        reducedRateEligible: false,
      }),
    ).toThrow();
  });
});
