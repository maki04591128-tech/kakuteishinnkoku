import { describe, expect, it } from "vitest";
import { simulateLowUtilizationLandSaleDeduction } from "./lowUtilizationLandSaleDeduction";

describe("simulateLowUtilizationLandSaleDeduction", () => {
  it("長期譲渡所得・譲渡価額500万円以下で要件を満たす場合、100万円特別控除後の金額に長期税率(20.315%)を適用する", () => {
    const result = simulateLowUtilizationLandSaleDeduction({
      transferPriceJpy: 4_000_000,
      acquisitionCostJpy: 1_000_000,
      transferExpensesJpy: 200_000,
      ownershipYears: 10,
      specialDeductionEligible: true,
    });

    expect(result.transferGainJpy.toNumber()).toBe(2_800_000);
    expect(result.holdingPeriodCategory).toBe("LONG_TERM");
    expect(result.priceLimitJpy.toNumber()).toBe(5_000_000);
    expect(result.priceLimitExceeded).toBe(false);
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(1_000_000);
    expect(result.taxableGainJpy.toNumber()).toBe(1_800_000);
    expect(result.nationalTaxJpy.toNumber()).toBeCloseTo(275_670, 0);
    expect(result.residentTaxJpy.toNumber()).toBe(90_000);
    expect(result.totalTaxJpy.toNumber()).toBeCloseTo(365_670, 0);
  });

  it("短期譲渡所得(所有期間5年以下)の場合、特別控除は適用できず短期税率(39.63%)を適用する", () => {
    const result = simulateLowUtilizationLandSaleDeduction({
      transferPriceJpy: 4_000_000,
      acquisitionCostJpy: 1_000_000,
      transferExpensesJpy: 200_000,
      ownershipYears: 3,
      specialDeductionEligible: true,
    });

    expect(result.holdingPeriodCategory).toBe("SHORT_TERM");
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(0);
    expect(result.taxableGainJpy.toNumber()).toBe(2_800_000);
    expect(result.notes.some((n) => n.includes("短期譲渡所得"))).toBe(true);
  });

  it("所有期間がちょうど5年の場合は短期譲渡所得として扱う", () => {
    const result = simulateLowUtilizationLandSaleDeduction({
      transferPriceJpy: 4_000_000,
      acquisitionCostJpy: 1_000_000,
      transferExpensesJpy: 200_000,
      ownershipYears: 5,
      specialDeductionEligible: true,
    });

    expect(result.holdingPeriodCategory).toBe("SHORT_TERM");
  });

  it("譲渡価額が500万円を超え特例区域にも該当しない場合、特別控除は適用されない", () => {
    const result = simulateLowUtilizationLandSaleDeduction({
      transferPriceJpy: 6_000_000,
      acquisitionCostJpy: 1_000_000,
      transferExpensesJpy: 200_000,
      ownershipYears: 10,
      specialDeductionEligible: true,
      inSpecialLowUtilizationArea: false,
    });

    expect(result.priceLimitJpy.toNumber()).toBe(5_000_000);
    expect(result.priceLimitExceeded).toBe(true);
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(0);
    expect(result.notes.some((n) => n.includes("上限"))).toBe(true);
  });

  it("特例区域内(inSpecialLowUtilizationArea=true)なら譲渡価額800万円までは上限内として特別控除を適用する", () => {
    const result = simulateLowUtilizationLandSaleDeduction({
      transferPriceJpy: 7_500_000,
      acquisitionCostJpy: 1_000_000,
      transferExpensesJpy: 200_000,
      ownershipYears: 10,
      specialDeductionEligible: true,
      inSpecialLowUtilizationArea: true,
    });

    expect(result.priceLimitJpy.toNumber()).toBe(8_000_000);
    expect(result.priceLimitExceeded).toBe(false);
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(1_000_000);
  });

  it("特例区域内でも譲渡価額が800万円を超える場合、特別控除は適用されない", () => {
    const result = simulateLowUtilizationLandSaleDeduction({
      transferPriceJpy: 9_000_000,
      acquisitionCostJpy: 1_000_000,
      transferExpensesJpy: 200_000,
      ownershipYears: 10,
      specialDeductionEligible: true,
      inSpecialLowUtilizationArea: true,
    });

    expect(result.priceLimitExceeded).toBe(true);
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(0);
  });

  it("譲渡益が控除限度額(100万円)未満なら、譲渡益全額を控除して税額は0円になる", () => {
    const result = simulateLowUtilizationLandSaleDeduction({
      transferPriceJpy: 3_000_000,
      acquisitionCostJpy: 2_200_000,
      transferExpensesJpy: 200_000,
      ownershipYears: 8,
      specialDeductionEligible: true,
    });

    expect(result.transferGainJpy.toNumber()).toBe(600_000);
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(600_000);
    expect(result.taxableGainJpy.toNumber()).toBe(0);
    expect(result.totalTaxJpy.toNumber()).toBe(0);
  });

  it("要件を満たさない場合は特別控除を適用せずに試算する", () => {
    const result = simulateLowUtilizationLandSaleDeduction({
      transferPriceJpy: 4_000_000,
      acquisitionCostJpy: 1_000_000,
      transferExpensesJpy: 200_000,
      ownershipYears: 10,
      specialDeductionEligible: false,
    });

    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(0);
    expect(result.taxableGainJpy.toNumber()).toBe(2_800_000);
    expect(result.notes.some((n) => n.includes("未適用"))).toBe(true);
  });

  it("譲渡損失の場合は税額0円で控除額も0円になる", () => {
    const result = simulateLowUtilizationLandSaleDeduction({
      transferPriceJpy: 2_000_000,
      acquisitionCostJpy: 2_500_000,
      transferExpensesJpy: 200_000,
      ownershipYears: 10,
      specialDeductionEligible: true,
    });

    expect(result.transferGainJpy.toNumber()).toBe(-700_000);
    expect(result.specialDeductionAppliedJpy.toNumber()).toBe(0);
    expect(result.taxableGainJpy.toNumber()).toBe(0);
    expect(result.totalTaxJpy.toNumber()).toBe(0);
  });

  it("取得費不明(0円)で概算取得費を希望する場合は譲渡価額の5%相当額を取得費として採用する", () => {
    const result = simulateLowUtilizationLandSaleDeduction({
      transferPriceJpy: 4_000_000,
      acquisitionCostJpy: 0,
      transferExpensesJpy: 200_000,
      ownershipYears: 10,
      specialDeductionEligible: true,
      useEstimatedAcquisitionCost: true,
    });

    // 概算取得費 = 4,000,000円 × 5% = 200,000円
    expect(result.acquisitionCostJpy.toNumber()).toBe(200_000);
    expect(result.estimatedAcquisitionCostApplied).toBe(true);
    expect(result.transferGainJpy.toNumber()).toBe(3_600_000);
    expect(result.notes.some((n) => n.includes("概算取得費の特例"))).toBe(true);
  });

  it("実際の取得費が譲渡価額の5%相当額以上なら、概算取得費を希望しても実際の取得費のまま", () => {
    const result = simulateLowUtilizationLandSaleDeduction({
      transferPriceJpy: 4_000_000,
      acquisitionCostJpy: 1_000_000,
      transferExpensesJpy: 200_000,
      ownershipYears: 10,
      specialDeductionEligible: true,
      useEstimatedAcquisitionCost: true,
    });

    expect(result.acquisitionCostJpy.toNumber()).toBe(1_000_000);
    expect(result.estimatedAcquisitionCostApplied).toBe(false);
  });

  it("所有期間が負または整数でない場合はエラーになる", () => {
    expect(() =>
      simulateLowUtilizationLandSaleDeduction({
        transferPriceJpy: 4_000_000,
        acquisitionCostJpy: 1_000_000,
        transferExpensesJpy: 200_000,
        ownershipYears: -1,
        specialDeductionEligible: true,
      }),
    ).toThrow();
    expect(() =>
      simulateLowUtilizationLandSaleDeduction({
        transferPriceJpy: 4_000_000,
        acquisitionCostJpy: 1_000_000,
        transferExpensesJpy: 200_000,
        ownershipYears: 1.5,
        specialDeductionEligible: true,
      }),
    ).toThrow();
  });

  it("譲渡価額・取得費・譲渡費用が負の場合はエラーになる", () => {
    expect(() =>
      simulateLowUtilizationLandSaleDeduction({
        transferPriceJpy: -1,
        acquisitionCostJpy: 0,
        transferExpensesJpy: 0,
        ownershipYears: 10,
        specialDeductionEligible: true,
      }),
    ).toThrow();
  });
});
