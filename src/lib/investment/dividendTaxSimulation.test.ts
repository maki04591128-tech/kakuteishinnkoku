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

  it("株式投資信託の分配金(半分税率)は配当控除が半分になる", () => {
    const result = simulateDividendTaxation({
      dividendIncomeJpy: 1_000_000,
      dividendCreditBreakdown: { halfCreditJpy: 1_000_000 },
      otherTaxableIncomeJpy: 5_000_000,
    });

    // 全額が1000万円以下の枠内: 5%+1.4%=6.4%
    expect(result.comprehensive.dividendCreditJpy?.toNumber()).toBeCloseTo(64_000, 0);
  });

  it("公社債投資信託・REIT等の分配金(対象外)は配当控除が発生しない", () => {
    const result = simulateDividendTaxation({
      dividendIncomeJpy: 1_000_000,
      dividendCreditBreakdown: { noCreditJpy: 1_000_000 },
      otherTaxableIncomeJpy: 5_000_000,
    });

    expect(result.comprehensive.dividendCreditJpy?.toNumber()).toBe(0);
    expect(result.notes.some((n) => n.includes("配当控除の対象外"))).toBe(true);
  });

  it("税率区分が混在する場合、通常税率の分から先に1000万円の枠を消費する", () => {
    // 他の所得900万円 + 通常税率200万円 = 1100万円 (100万円が枠超過)
    // 通常税率: 枠内100万円(10%+2.8%) + 枠超100万円(5%+1.4%)
    // 半分税率: 全額枠超(2.5%+0.7%)
    const result = simulateDividendTaxation({
      dividendIncomeJpy: 3_000_000,
      dividendCreditBreakdown: { halfCreditJpy: 1_000_000 },
      otherTaxableIncomeJpy: 9_000_000,
    });

    const expectedCredit =
      1_000_000 * 0.128 + 1_000_000 * 0.064 + 1_000_000 * (0.025 + 0.007);
    expect(result.comprehensive.dividendCreditJpy?.toNumber()).toBeCloseTo(expectedCredit, 0);
  });

  it("内訳の合計が配当所得金額を超える場合はエラーになる", () => {
    expect(() =>
      simulateDividendTaxation({
        dividendIncomeJpy: 1_000_000,
        dividendCreditBreakdown: { halfCreditJpy: 600_000, noCreditJpy: 600_000 },
        otherTaxableIncomeJpy: 5_000_000,
      }),
    ).toThrow();
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
