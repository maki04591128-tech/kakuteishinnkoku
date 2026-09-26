import { describe, expect, it } from "vitest";
import { simulateExpropriationReplacementDeferral } from "./expropriationReplacementDeferral";

describe("simulateExpropriationReplacementDeferral", () => {
  it("代替資産の取得価額が譲渡価額を下回る場合、差金額に対応する部分のみ課税する(長期譲渡所得)", () => {
    const result = simulateExpropriationReplacementDeferral({
      transferPriceJpy: 80_000_000,
      acquisitionCostJpy: 10_000_000,
      transferExpensesJpy: 2_000_000,
      replacementAssetAcquisitionCostJpy: 60_000_000,
      ownershipYears: 10,
      deferralEligible: true,
    });

    expect(result.transferGainJpy.toNumber()).toBe(68_000_000);
    expect(result.holdingPeriodCategory).toBe("LONG_TERM");
    expect(result.taxableProceedsJpy.toNumber()).toBe(20_000_000);
    expect(result.fullyDeferred).toBe(false);
    expect(result.taxableGainJpy.toNumber()).toBe(17_000_000);
    expect(result.deferredGainJpy.toNumber()).toBe(51_000_000);
    expect(result.replacementAssetCarryoverCostJpy.toNumber()).toBe(9_000_000);
    expect(result.nationalTaxJpy.toNumber()).toBeCloseTo(2_603_550, 0);
    expect(result.residentTaxJpy.toNumber()).toBe(850_000);
    expect(result.totalTaxJpy.toNumber()).toBeCloseTo(3_453_550, 0);
  });

  it("代替資産の取得価額が譲渡価額以上の場合、譲渡益の全額が繰り延べられ税額は0円になる", () => {
    const result = simulateExpropriationReplacementDeferral({
      transferPriceJpy: 80_000_000,
      acquisitionCostJpy: 10_000_000,
      transferExpensesJpy: 2_000_000,
      replacementAssetAcquisitionCostJpy: 90_000_000,
      ownershipYears: 10,
      deferralEligible: true,
    });

    expect(result.fullyDeferred).toBe(true);
    expect(result.taxableProceedsJpy.toNumber()).toBe(0);
    expect(result.taxableGainJpy.toNumber()).toBe(0);
    expect(result.deferredGainJpy.toNumber()).toBe(68_000_000);
    expect(result.replacementAssetCarryoverCostJpy.toNumber()).toBe(22_000_000);
    expect(result.totalTaxJpy.toNumber()).toBe(0);
    expect(result.notes.some((n) => n.includes("上限として繰延べに充当"))).toBe(true);
  });

  it("要件を満たさない場合は繰延べを適用せず、譲渡益全額に課税する", () => {
    const result = simulateExpropriationReplacementDeferral({
      transferPriceJpy: 80_000_000,
      acquisitionCostJpy: 10_000_000,
      transferExpensesJpy: 2_000_000,
      replacementAssetAcquisitionCostJpy: 60_000_000,
      ownershipYears: 10,
      deferralEligible: false,
    });

    expect(result.taxableProceedsJpy.toNumber()).toBe(80_000_000);
    expect(result.taxableGainJpy.toNumber()).toBe(68_000_000);
    expect(result.deferredGainJpy.toNumber()).toBe(0);
    expect(result.replacementAssetCarryoverCostJpy.toNumber()).toBe(60_000_000);
    expect(result.notes.some((n) => n.includes("未適用"))).toBe(true);
  });

  it("短期譲渡所得(所有期間5年以下)の場合、短期税率(39.63%)を適用する", () => {
    const result = simulateExpropriationReplacementDeferral({
      transferPriceJpy: 40_000_000,
      acquisitionCostJpy: 5_000_000,
      transferExpensesJpy: 1_000_000,
      replacementAssetAcquisitionCostJpy: 0,
      ownershipYears: 5,
      deferralEligible: true,
    });

    expect(result.holdingPeriodCategory).toBe("SHORT_TERM");
    expect(result.transferGainJpy.toNumber()).toBe(34_000_000);
    expect(result.taxableGainJpy.toNumber()).toBe(34_000_000);
    expect(result.nationalTaxJpy.toNumber()).toBeCloseTo(10_414_200, 0);
    expect(result.residentTaxJpy.toNumber()).toBe(3_060_000);
  });

  it("譲渡損失の場合は税額0円で繰延べも生じない", () => {
    const result = simulateExpropriationReplacementDeferral({
      transferPriceJpy: 5_000_000,
      acquisitionCostJpy: 6_000_000,
      transferExpensesJpy: 500_000,
      replacementAssetAcquisitionCostJpy: 3_000_000,
      ownershipYears: 10,
      deferralEligible: true,
    });

    expect(result.transferGainJpy.toNumber()).toBe(-1_500_000);
    expect(result.taxableProceedsJpy.toNumber()).toBe(0);
    expect(result.taxableGainJpy.toNumber()).toBe(0);
    expect(result.totalTaxJpy.toNumber()).toBe(0);
    expect(result.replacementAssetCarryoverCostJpy.toNumber()).toBe(3_000_000);
  });

  it("取得費不明(0円)で概算取得費を希望する場合は譲渡価額の5%相当額を取得費として採用する", () => {
    const result = simulateExpropriationReplacementDeferral({
      transferPriceJpy: 80_000_000,
      acquisitionCostJpy: 0,
      transferExpensesJpy: 2_000_000,
      replacementAssetAcquisitionCostJpy: 0,
      ownershipYears: 10,
      deferralEligible: false,
      useEstimatedAcquisitionCost: true,
    });

    // 概算取得費 = 80,000,000円 × 5% = 4,000,000円
    expect(result.acquisitionCostJpy.toNumber()).toBe(4_000_000);
    expect(result.estimatedAcquisitionCostApplied).toBe(true);
    expect(result.transferGainJpy.toNumber()).toBe(74_000_000);
    expect(result.notes.some((n) => n.includes("概算取得費の特例"))).toBe(true);
  });

  it("所有期間が負または整数でない場合はエラーになる", () => {
    expect(() =>
      simulateExpropriationReplacementDeferral({
        transferPriceJpy: 80_000_000,
        acquisitionCostJpy: 10_000_000,
        transferExpensesJpy: 2_000_000,
        replacementAssetAcquisitionCostJpy: 0,
        ownershipYears: -1,
        deferralEligible: true,
      }),
    ).toThrow();
    expect(() =>
      simulateExpropriationReplacementDeferral({
        transferPriceJpy: 80_000_000,
        acquisitionCostJpy: 10_000_000,
        transferExpensesJpy: 2_000_000,
        replacementAssetAcquisitionCostJpy: 0,
        ownershipYears: 1.5,
        deferralEligible: true,
      }),
    ).toThrow();
  });

  it("譲渡価額・取得費・譲渡費用・代替資産の取得価額が負の場合はエラーになる", () => {
    expect(() =>
      simulateExpropriationReplacementDeferral({
        transferPriceJpy: -1,
        acquisitionCostJpy: 0,
        transferExpensesJpy: 0,
        replacementAssetAcquisitionCostJpy: 0,
        ownershipYears: 10,
        deferralEligible: true,
      }),
    ).toThrow();
    expect(() =>
      simulateExpropriationReplacementDeferral({
        transferPriceJpy: 80_000_000,
        acquisitionCostJpy: 10_000_000,
        transferExpensesJpy: 2_000_000,
        replacementAssetAcquisitionCostJpy: -1,
        ownershipYears: 10,
        deferralEligible: true,
      }),
    ).toThrow();
  });
});
