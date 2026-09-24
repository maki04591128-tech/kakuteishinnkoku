import { describe, expect, it } from "vitest";
import { estimateDistributionAdjustedForeignTaxCredit } from "./distributionAdjustedForeignTaxCredit";

describe("estimateDistributionAdjustedForeignTaxCredit", () => {
  it("所得税額の範囲内であれば入力額をそのまま控除額とする", () => {
    const result = estimateDistributionAdjustedForeignTaxCredit({
      distributionAdjustedForeignTaxJpy: 3_000,
      nationalTaxBeforeCreditJpy: 500_000,
    });

    expect(result.creditJpy.toNumber()).toBe(3_000);
    expect(result.notes.some((n) => n.includes("超過分"))).toBe(false);
  });

  it("所得税額を上回る場合は所得税額で頭打ちにし、超過分は切り捨てる(繰越なし)", () => {
    const result = estimateDistributionAdjustedForeignTaxCredit({
      distributionAdjustedForeignTaxJpy: 10_000,
      nationalTaxBeforeCreditJpy: 4_000,
    });

    expect(result.creditJpy.toNumber()).toBe(4_000);
    expect(result.notes.some((n) => n.includes("超過分"))).toBe(true);
  });

  it("入力額が0円の場合は控除額も0円になる", () => {
    const result = estimateDistributionAdjustedForeignTaxCredit({
      distributionAdjustedForeignTaxJpy: 0,
      nationalTaxBeforeCreditJpy: 500_000,
    });

    expect(result.creditJpy.toNumber()).toBe(0);
  });

  it("負の値を入力するとエラーになる", () => {
    expect(() =>
      estimateDistributionAdjustedForeignTaxCredit({
        distributionAdjustedForeignTaxJpy: -1,
        nationalTaxBeforeCreditJpy: 500_000,
      }),
    ).toThrow();
    expect(() =>
      estimateDistributionAdjustedForeignTaxCredit({
        distributionAdjustedForeignTaxJpy: 1000,
        nationalTaxBeforeCreditJpy: -1,
      }),
    ).toThrow();
  });
});
