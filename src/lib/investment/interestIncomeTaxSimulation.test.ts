import { describe, expect, it } from "vitest";
import { simulateBondInterestIncomeTaxation } from "./interestIncomeTaxSimulation";

describe("simulateBondInterestIncomeTaxation", () => {
  it("申告不要は源泉徴収税率20.315%どおりに計算する", () => {
    const result = simulateBondInterestIncomeTaxation({
      interestIncomeJpy: 1_000_000,
    });

    expect(result.noFiling.totalTaxJpy.toNumber()).toBeCloseTo(203_150, 0);
    expect(result.noFiling.nationalTaxJpy.toNumber()).toBeCloseTo(153_150, 0);
    expect(result.noFiling.residentTaxJpy.toNumber()).toBe(50_000);
    expect(result.noFiling.taxableInterestJpy.toNumber()).toBe(1_000_000);
  });

  it("損益通算する損失が無い場合、申告分離課税と申告不要の税額は一致する", () => {
    const result = simulateBondInterestIncomeTaxation({
      interestIncomeJpy: 1_000_000,
    });

    expect(result.separate.totalTaxJpy.toNumber()).toBeCloseTo(
      result.noFiling.totalTaxJpy.toNumber(),
      0,
    );
    expect(result.separate.lossOffsetUsedJpy?.toNumber()).toBe(0);
    // 同額の場合はNO_FILING(申告不要)を優先する
    expect(result.recommendedMethod).toBe("NO_FILING");
  });

  it("申告分離課税は上場株式等の譲渡損失と損益通算できる", () => {
    const result = simulateBondInterestIncomeTaxation({
      interestIncomeJpy: 1_000_000,
      availableListedStockLossJpy: 700_000,
    });

    expect(result.separate.lossOffsetUsedJpy?.toNumber()).toBe(700_000);
    expect(result.separate.taxableInterestJpy.toNumber()).toBe(300_000);
    expect(result.separate.totalTaxJpy.toNumber()).toBeCloseTo(60_945, 0);
    expect(result.remainingListedStockLossJpy.toNumber()).toBe(0);
    expect(result.recommendedMethod).toBe("SEPARATE");
  });

  it("損失が利子所得の金額を上回る場合は課税対象がゼロになり、残りは繰り越される", () => {
    const result = simulateBondInterestIncomeTaxation({
      interestIncomeJpy: 500_000,
      availableListedStockLossJpy: 900_000,
    });

    expect(result.separate.taxableInterestJpy.toNumber()).toBe(0);
    expect(result.separate.totalTaxJpy.toNumber()).toBe(0);
    expect(result.remainingListedStockLossJpy.toNumber()).toBe(400_000);
    expect(result.recommendedMethod).toBe("SEPARATE");
  });

  it("負の値は拒否する", () => {
    expect(() =>
      simulateBondInterestIncomeTaxation({ interestIncomeJpy: -1 }),
    ).toThrow();
    expect(() =>
      simulateBondInterestIncomeTaxation({
        interestIncomeJpy: 100,
        availableListedStockLossJpy: -1,
      }),
    ).toThrow();
  });
});
