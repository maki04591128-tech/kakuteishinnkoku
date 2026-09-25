import { describe, expect, it } from "vitest";
import { estimateDisasterTaxReduction } from "./disasterTaxReduction";

describe("estimateDisasterTaxReduction", () => {
  it("損害金額が住宅家財の価額の2分の1未満なら適用要件を満たさず軽減額は0になる", () => {
    const result = estimateDisasterTaxReduction({
      totalIncomeJpy: 3_000_000,
      propertyValueJpy: 10_000_000,
      damageAmountJpy: 4_000_000,
      nationalTaxBeforeReductionJpy: 200_000,
    });

    expect(result.meetsDamageThreshold).toBe(false);
    expect(result.reductionRate).toBe("NONE");
    expect(result.reductionAmountJpy.toNumber()).toBe(0);
    expect(result.reducedNationalTaxJpy.toNumber()).toBe(200_000);
  });

  it("合計所得金額500万円以下なら所得税額の全額が免除になる", () => {
    const result = estimateDisasterTaxReduction({
      totalIncomeJpy: 5_000_000,
      propertyValueJpy: 10_000_000,
      damageAmountJpy: 5_000_000,
      nationalTaxBeforeReductionJpy: 300_000,
    });

    expect(result.meetsDamageThreshold).toBe(true);
    expect(result.reductionRate).toBe("FULL");
    expect(result.reductionAmountJpy.toNumber()).toBe(300_000);
    expect(result.reducedNationalTaxJpy.toNumber()).toBe(0);
  });

  it("合計所得金額500万円超750万円以下なら所得税額の2分の1が軽減される", () => {
    const result = estimateDisasterTaxReduction({
      totalIncomeJpy: 6_000_000,
      propertyValueJpy: 10_000_000,
      damageAmountJpy: 5_000_000,
      nationalTaxBeforeReductionJpy: 400_000,
    });

    expect(result.reductionRate).toBe("HALF");
    expect(result.reductionAmountJpy.toNumber()).toBe(200_000);
    expect(result.reducedNationalTaxJpy.toNumber()).toBe(200_000);
  });

  it("合計所得金額750万円超1000万円以下なら所得税額の4分の1が軽減される", () => {
    const result = estimateDisasterTaxReduction({
      totalIncomeJpy: 9_000_000,
      propertyValueJpy: 10_000_000,
      damageAmountJpy: 5_000_000,
      nationalTaxBeforeReductionJpy: 800_000,
    });

    expect(result.reductionRate).toBe("QUARTER");
    expect(result.reductionAmountJpy.toNumber()).toBe(200_000);
    expect(result.reducedNationalTaxJpy.toNumber()).toBe(600_000);
  });

  it("合計所得金額1000万円超なら適用要件を満たしていても軽減は無い", () => {
    const result = estimateDisasterTaxReduction({
      totalIncomeJpy: 10_000_001,
      propertyValueJpy: 10_000_000,
      damageAmountJpy: 5_000_000,
      nationalTaxBeforeReductionJpy: 1_500_000,
    });

    expect(result.meetsDamageThreshold).toBe(true);
    expect(result.reductionRate).toBe("NONE");
    expect(result.reductionAmountJpy.toNumber()).toBe(0);
    expect(result.reducedNationalTaxJpy.toNumber()).toBe(1_500_000);
  });

  it("損害金額がちょうど価額の2分の1であれば適用要件を満たす", () => {
    const result = estimateDisasterTaxReduction({
      totalIncomeJpy: 4_000_000,
      propertyValueJpy: 10_000_000,
      damageAmountJpy: 5_000_000,
      nationalTaxBeforeReductionJpy: 100_000,
    });

    expect(result.meetsDamageThreshold).toBe(true);
    expect(result.reductionRate).toBe("FULL");
  });

  it("住宅又は家財の価額が0円だとエラーになる", () => {
    expect(() =>
      estimateDisasterTaxReduction({
        totalIncomeJpy: 3_000_000,
        propertyValueJpy: 0,
        damageAmountJpy: 0,
        nationalTaxBeforeReductionJpy: 0,
      }),
    ).toThrow();
  });

  it("負の値を入力するとエラーになる", () => {
    expect(() =>
      estimateDisasterTaxReduction({
        totalIncomeJpy: -1,
        propertyValueJpy: 10_000_000,
        damageAmountJpy: 0,
        nationalTaxBeforeReductionJpy: 0,
      }),
    ).toThrow();
  });
});
