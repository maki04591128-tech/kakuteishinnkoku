import { describe, expect, it } from "vitest";
import { simulateVacantHouseSaleTax } from "./vacantHouseSaleTaxSimulation";

describe("simulateVacantHouseSaleTax", () => {
  it("要件を満たす場合、3,000万円特別控除後の金額に長期譲渡所得の税率(20.315%)を適用する", () => {
    const result = simulateVacantHouseSaleTax({
      transferPriceJpy: 50_000_000,
      acquisitionCostJpy: 5_000_000,
      transferExpensesJpy: 1_000_000,
      heirCount: 1,
      eligibilityConfirmed: true,
      demolishedOrEarthquakeResistant: true,
    });

    expect(result.transferGainJpy.toNumber()).toBe(44_000_000);
    expect(result.eligible).toBe(true);
    expect(result.specialDeductionLimitJpy.toNumber()).toBe(30_000_000);
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(30_000_000);
    expect(result.taxableGainJpy.toNumber()).toBe(14_000_000);
    expect(result.nationalTaxJpy.toNumber()).toBeCloseTo(2_144_100, 0);
    expect(result.residentTaxJpy.toNumber()).toBe(700_000);
    expect(result.totalTaxJpy.toNumber()).toBeCloseTo(2_844_100, 0);
  });

  it("譲渡益が控除限度額未満なら、譲渡益全額を控除して税額は0円になる", () => {
    const result = simulateVacantHouseSaleTax({
      transferPriceJpy: 20_000_000,
      acquisitionCostJpy: 3_000_000,
      transferExpensesJpy: 500_000,
      heirCount: 1,
      eligibilityConfirmed: true,
      demolishedOrEarthquakeResistant: true,
    });

    expect(result.transferGainJpy.toNumber()).toBe(16_500_000);
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(16_500_000);
    expect(result.taxableGainJpy.toNumber()).toBe(0);
    expect(result.totalTaxJpy.toNumber()).toBe(0);
  });

  it("相続人が3人以上の場合、控除限度額は2,000万円になる", () => {
    const result = simulateVacantHouseSaleTax({
      transferPriceJpy: 60_000_000,
      acquisitionCostJpy: 5_000_000,
      transferExpensesJpy: 1_000_000,
      heirCount: 3,
      eligibilityConfirmed: true,
      demolishedOrEarthquakeResistant: true,
    });

    expect(result.specialDeductionLimitJpy.toNumber()).toBe(20_000_000);
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(20_000_000);
    expect(result.taxableGainJpy.toNumber()).toBe(34_000_000);
    expect(result.notes.some((n) => n.includes("2,000万円"))).toBe(true);
  });

  it("譲渡対価が1億円を超える場合は自動的に特例の対象外になる", () => {
    const result = simulateVacantHouseSaleTax({
      transferPriceJpy: 150_000_000,
      acquisitionCostJpy: 10_000_000,
      transferExpensesJpy: 2_000_000,
      heirCount: 1,
      eligibilityConfirmed: true,
      demolishedOrEarthquakeResistant: true,
    });

    expect(result.transferPriceExceedsLimit).toBe(true);
    expect(result.eligible).toBe(false);
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(0);
    expect(result.taxableGainJpy.toNumber()).toBe(result.transferGainJpy.toNumber());
    expect(result.notes.some((n) => n.includes("1億円を超えている"))).toBe(true);
  });

  it("要件確認のチェックが無い場合は特例を適用せずに試算する", () => {
    const result = simulateVacantHouseSaleTax({
      transferPriceJpy: 50_000_000,
      acquisitionCostJpy: 5_000_000,
      transferExpensesJpy: 1_000_000,
      heirCount: 1,
      eligibilityConfirmed: false,
      demolishedOrEarthquakeResistant: true,
    });

    expect(result.eligible).toBe(false);
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(0);
    expect(result.taxableGainJpy.toNumber()).toBe(44_000_000);
  });

  it("耐震基準適合・取壊しのいずれも満たさない場合は特例を適用せずに試算する", () => {
    const result = simulateVacantHouseSaleTax({
      transferPriceJpy: 50_000_000,
      acquisitionCostJpy: 5_000_000,
      transferExpensesJpy: 1_000_000,
      heirCount: 1,
      eligibilityConfirmed: true,
      demolishedOrEarthquakeResistant: false,
    });

    expect(result.eligible).toBe(false);
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(0);
  });

  it("譲渡損失の場合は税額0円で控除額も0円になる", () => {
    const result = simulateVacantHouseSaleTax({
      transferPriceJpy: 5_000_000,
      acquisitionCostJpy: 6_000_000,
      transferExpensesJpy: 500_000,
      heirCount: 1,
      eligibilityConfirmed: true,
      demolishedOrEarthquakeResistant: true,
    });

    expect(result.transferGainJpy.toNumber()).toBe(-1_500_000);
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(0);
    expect(result.taxableGainJpy.toNumber()).toBe(0);
    expect(result.totalTaxJpy.toNumber()).toBe(0);
  });

  it("相続人の数が1未満または整数でない場合はエラーになる", () => {
    expect(() =>
      simulateVacantHouseSaleTax({
        transferPriceJpy: 50_000_000,
        acquisitionCostJpy: 5_000_000,
        transferExpensesJpy: 1_000_000,
        heirCount: 0,
        eligibilityConfirmed: true,
        demolishedOrEarthquakeResistant: true,
      }),
    ).toThrow();
    expect(() =>
      simulateVacantHouseSaleTax({
        transferPriceJpy: 50_000_000,
        acquisitionCostJpy: 5_000_000,
        transferExpensesJpy: 1_000_000,
        heirCount: 1.5,
        eligibilityConfirmed: true,
        demolishedOrEarthquakeResistant: true,
      }),
    ).toThrow();
  });
});
