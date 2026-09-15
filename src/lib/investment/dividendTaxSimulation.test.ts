import { describe, expect, it } from "vitest";
import { simulateDividendTaxation } from "./dividendTaxSimulation";

describe("simulateDividendTaxation", () => {
  it("申告不要は源泉徴収税率20.315%どおりに計算する", () => {
    const result = simulateDividendTaxation({
      dividendIncomeJpy: 1_000_000,
      otherTaxableIncomeJpy: 5_000_000,
    });

    expect(result.noFiling.totalTaxJpy.toNumber()).toBeCloseTo(203_150, 0);
    expect(result.noFiling.nationalTaxJpy.toNumber()).toBeCloseTo(153_150, 0);
    expect(result.noFiling.residentTaxJpy.toNumber()).toBe(50_000);
  });

  it("申告分離課税は20.315%固定で、配当控除は適用されない", () => {
    const result = simulateDividendTaxation({
      dividendIncomeJpy: 1_000_000,
      otherTaxableIncomeJpy: 5_000_000,
    });

    expect(result.separate.dividendCreditJpy).toBeUndefined();
    expect(result.separate.totalTaxJpy.toNumber()).toBeCloseTo(203_150, 0);
    expect(result.separate.taxableDividendJpy.toNumber()).toBe(1_000_000);
  });

  it("申告分離課税は上場株式等の譲渡損失と損益通算できる", () => {
    const result = simulateDividendTaxation({
      dividendIncomeJpy: 1_000_000,
      otherTaxableIncomeJpy: 5_000_000,
      availableListedStockLossJpy: 700_000,
    });

    expect(result.separate.lossOffsetUsedJpy?.toNumber()).toBe(700_000);
    expect(result.separate.taxableDividendJpy.toNumber()).toBe(300_000);
    expect(result.separate.totalTaxJpy.toNumber()).toBeCloseTo(60_945, 0);
    expect(result.remainingListedStockLossJpy.toNumber()).toBe(0);
    expect(result.recommendedMethod).toBe("SEPARATE");
  });

  it("損失が配当額を上回る場合は課税対象がゼロになり、残りは繰り越される", () => {
    const result = simulateDividendTaxation({
      dividendIncomeJpy: 500_000,
      otherTaxableIncomeJpy: 5_000_000,
      availableListedStockLossJpy: 900_000,
    });

    expect(result.separate.taxableDividendJpy.toNumber()).toBe(0);
    expect(result.separate.totalTaxJpy.toNumber()).toBe(0);
    expect(result.remainingListedStockLossJpy.toNumber()).toBe(400_000);
  });

  it("課税所得が低い場合、総合課税は配当控除により税負担が最も軽くなり得る", () => {
    // 他の所得が少なく所得税率5%の帯にとどまる場合、総合課税の実効負担率
    // (所得税5%+住民税10%-配当控除12.8%=2.2%)は分離課税・申告不要の20.315%を大きく下回る
    const result = simulateDividendTaxation({
      dividendIncomeJpy: 500_000,
      otherTaxableIncomeJpy: 1_000_000,
    });

    expect(result.recommendedMethod).toBe("COMPREHENSIVE");
    expect(result.comprehensive.totalTaxJpy.toNumber()).toBeLessThan(
      result.separate.totalTaxJpy.toNumber(),
    );
  });

  it("高所得帯では総合課税の税率が20.315%を上回り、申告不要/分離課税が有利になる", () => {
    const result = simulateDividendTaxation({
      dividendIncomeJpy: 1_000_000,
      otherTaxableIncomeJpy: 20_000_000,
    });

    expect(result.recommendedMethod).not.toBe("COMPREHENSIVE");
    expect(result.comprehensive.totalTaxJpy.toNumber()).toBeGreaterThan(
      result.separate.totalTaxJpy.toNumber(),
    );
  });

  it("合計所得金額が1000万円を超える部分は配当控除率が半分になる", () => {
    const result = simulateDividendTaxation({
      dividendIncomeJpy: 2_000_000,
      otherTaxableIncomeJpy: 9_000_000,
    });

    // 1000万円までの枠 1,000,000円分は10%+2.8%、残り1,000,000円分は5%+1.4%
    const expectedCredit = 1_000_000 * 0.128 + 1_000_000 * 0.064;
    expect(result.comprehensive.dividendCreditJpy?.toNumber()).toBeCloseTo(expectedCredit, 0);
  });

  it("負の入力値はエラーになる", () => {
    expect(() =>
      simulateDividendTaxation({ dividendIncomeJpy: -1, otherTaxableIncomeJpy: 0 }),
    ).toThrow();
    expect(() =>
      simulateDividendTaxation({ dividendIncomeJpy: 0, otherTaxableIncomeJpy: -1 }),
    ).toThrow();
    expect(() =>
      simulateDividendTaxation({
        dividendIncomeJpy: 0,
        otherTaxableIncomeJpy: 0,
        availableListedStockLossJpy: -1,
      }),
    ).toThrow();
  });
});
