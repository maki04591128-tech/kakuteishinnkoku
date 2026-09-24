import { describe, expect, it } from "vitest";
import { estimatePublicPensionIncome } from "./publicPensionIncome";

describe("estimatePublicPensionIncome", () => {
  it("65歳未満・最低保障額区分(公的年金等以外の所得1,000万円以下)", () => {
    // 高岡市・伊万里市の公式ページの計算例と一致: 750,000円-600,000円=150,000円
    const result = estimatePublicPensionIncome({
      pensionIncomeJpy: 750_000,
      isAge65OrOlder: false,
      otherIncomeExcludingPensionJpy: 5_000_000,
    });
    expect(result.deductionJpy.toNumber()).toBe(600_000);
    expect(result.miscIncomeJpy.toNumber()).toBe(150_000);
  });

  it("65歳未満・公的年金等以外の所得1,000万円超2,000万円以下の逓減区分", () => {
    // 伊万里市の公式ページの計算例と一致: 1,450,000円×75%-175,000円=912,500円
    const result = estimatePublicPensionIncome({
      pensionIncomeJpy: 1_450_000,
      isAge65OrOlder: false,
      otherIncomeExcludingPensionJpy: 15_000_000,
    });
    expect(result.miscIncomeJpy.toNumber()).toBe(912_500);
    expect(result.deductionJpy.toNumber()).toBe(1_450_000 - 912_500);
  });

  it("65歳以上・最低保障額区分(公的年金等以外の所得1,000万円以下)", () => {
    // 伊万里市の公式ページの計算例と一致: 1,450,000円-1,100,000円=350,000円
    const result = estimatePublicPensionIncome({
      pensionIncomeJpy: 1_450_000,
      isAge65OrOlder: true,
      otherIncomeExcludingPensionJpy: 5_000_000,
    });
    expect(result.deductionJpy.toNumber()).toBe(1_100_000);
    expect(result.miscIncomeJpy.toNumber()).toBe(350_000);
  });

  it("65歳以上・最低保障額を下回る収入は雑所得0円、控除額は収入金額そのもの", () => {
    const result = estimatePublicPensionIncome({
      pensionIncomeJpy: 800_000,
      isAge65OrOlder: true,
      otherIncomeExcludingPensionJpy: 0,
    });
    expect(result.miscIncomeJpy.toNumber()).toBe(0);
    expect(result.deductionJpy.toNumber()).toBe(800_000);
  });

  it("65歳未満・収入0円は雑所得0円・控除額0円", () => {
    const result = estimatePublicPensionIncome({
      pensionIncomeJpy: 0,
      isAge65OrOlder: false,
      otherIncomeExcludingPensionJpy: 0,
    });
    expect(result.miscIncomeJpy.toNumber()).toBe(0);
    expect(result.deductionJpy.toNumber()).toBe(0);
  });

  it("65歳以上・区分境界(410万円)は×85%区分ではなく×75%区分を適用(以下=境界値を含む)", () => {
    const atBoundary = estimatePublicPensionIncome({
      pensionIncomeJpy: 4_100_000,
      isAge65OrOlder: true,
      otherIncomeExcludingPensionJpy: 5_000_000,
    });
    // 4,100,000×0.75-275,000=2,800,000
    expect(atBoundary.miscIncomeJpy.toNumber()).toBe(2_800_000);

    const aboveBoundary = estimatePublicPensionIncome({
      pensionIncomeJpy: 4_100_001,
      isAge65OrOlder: true,
      otherIncomeExcludingPensionJpy: 5_000_000,
    });
    // 4,100,001×0.85-685,000=2,800,000.85 (端数はDecimalのまま保持)
    expect(aboveBoundary.miscIncomeJpy.toNumber()).toBeCloseTo(2_800_000.85, 2);
  });

  it("最上位所得区分(2,000万円超)は控除額がさらに減る", () => {
    const result = estimatePublicPensionIncome({
      pensionIncomeJpy: 12_000_000,
      isAge65OrOlder: true,
      otherIncomeExcludingPensionJpy: 25_000_000,
    });
    // 12,000,000-1,755,000=10,245,000
    expect(result.miscIncomeJpy.toNumber()).toBe(10_245_000);
  });

  it("収入金額が負の値だとエラーになる", () => {
    expect(() =>
      estimatePublicPensionIncome({
        pensionIncomeJpy: -1,
        isAge65OrOlder: false,
        otherIncomeExcludingPensionJpy: 0,
      }),
    ).toThrow();
  });
});
