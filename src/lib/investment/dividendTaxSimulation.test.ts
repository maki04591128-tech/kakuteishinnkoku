import { describe, expect, it } from "vitest";
import { simulateDividendTaxation, simulateNonListedDividendTaxation } from "./dividendTaxSimulation";

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

  it("外貨建資産等の組入割合が50%超の株式投資信託の分配金(1/4税率)は配当控除が1/4になる", () => {
    const result = simulateDividendTaxation({
      dividendIncomeJpy: 1_000_000,
      dividendCreditBreakdown: { quarterCreditJpy: 1_000_000 },
      otherTaxableIncomeJpy: 5_000_000,
    });

    // 全額が1000万円以下の枠内: 2.5%+0.7%=3.2%
    expect(result.comprehensive.dividendCreditJpy?.toNumber()).toBeCloseTo(32_000, 0);
  });

  it("半分税率・1/4税率が混在する場合、半分税率の分から先に1000万円の枠を消費する", () => {
    // 他の所得900万円 + 半分税率100万円 + 1/4税率100万円 = 1100万円 (100万円が枠超過)
    // 半分税率: 枠内100万円(5%+1.4%)
    // 1/4税率: 全額枠超(1.25%+0.35%)
    const result = simulateDividendTaxation({
      dividendIncomeJpy: 2_000_000,
      dividendCreditBreakdown: { halfCreditJpy: 1_000_000, quarterCreditJpy: 1_000_000 },
      otherTaxableIncomeJpy: 9_000_000,
    });

    const expectedCredit = 1_000_000 * 0.064 + 1_000_000 * (0.0125 + 0.0035);
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

  it("内訳の合計(半分税率+1/4税率+対象外)が配当所得金額を超える場合はエラーになる", () => {
    expect(() =>
      simulateDividendTaxation({
        dividendIncomeJpy: 1_000_000,
        dividendCreditBreakdown: { halfCreditJpy: 400_000, quarterCreditJpy: 400_000, noCreditJpy: 400_000 },
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

describe("simulateNonListedDividendTaxation", () => {
  it("少額配当該当額が0の場合は総合課税のみが選択肢になる", () => {
    const result = simulateNonListedDividendTaxation({
      nonListedDividendIncomeJpy: 500_000,
      otherTaxableIncomeJpy: 5_000_000,
    });

    expect(result.smallDividendNoFiling).toBeUndefined();
    expect(result.recommendedMethod).toBe("REPORT_ALL");
    expect(result.reportAll.nationalReportedDividendJpy.toNumber()).toBe(500_000);
  });

  it("総合課税は配当控除(通常税率)を適用する", () => {
    const result = simulateNonListedDividendTaxation({
      nonListedDividendIncomeJpy: 1_000_000,
      otherTaxableIncomeJpy: 5_000_000,
    });

    // 全額1000万円以下の枠内: 国税10%+住民税2.8%=12.8%
    expect(result.reportAll.dividendCreditJpy.toNumber()).toBeCloseTo(128_000, 0);
  });

  it("住民税は所得税側の選択にかかわらず常に配当全額を総合課税で計算する", () => {
    const result = simulateNonListedDividendTaxation({
      nonListedDividendIncomeJpy: 1_000_000,
      smallDividendJpy: 1_000_000,
      otherTaxableIncomeJpy: 5_000_000,
    });

    expect(result.smallDividendNoFiling).toBeDefined();
    expect(result.reportAll.residentTaxJpy.toNumber()).toBeCloseTo(
      result.smallDividendNoFiling!.residentTaxJpy.toNumber(),
      6,
    );
  });

  it("少額配当を申告不要にした場合、その部分は20.42%源泉徴収で確定し配当控除は受けられない", () => {
    const result = simulateNonListedDividendTaxation({
      nonListedDividendIncomeJpy: 1_000_000,
      smallDividendJpy: 1_000_000,
      otherTaxableIncomeJpy: 5_000_000,
    });

    expect(result.smallDividendNoFiling!.nationalReportedDividendJpy.toNumber()).toBe(0);
    expect(result.smallDividendNoFiling!.nationalTaxJpy.toNumber()).toBe(0);
    expect(result.smallDividendNoFiling!.nationalWithholdingFinalJpy?.toNumber()).toBeCloseTo(
      204_200,
      0,
    );
    // 所得税分の配当控除は0だが、住民税は常に総合課税のため住民税分(2.8%)の配当控除は残る
    expect(result.smallDividendNoFiling!.dividendCreditJpy.toNumber()).toBeCloseTo(28_000, 0);
  });

  it("少額配当の一部のみ該当する場合、残りは総合課税で申告する", () => {
    const result = simulateNonListedDividendTaxation({
      nonListedDividendIncomeJpy: 1_000_000,
      smallDividendJpy: 300_000,
      otherTaxableIncomeJpy: 5_000_000,
    });

    expect(result.smallDividendNoFiling!.nationalReportedDividendJpy.toNumber()).toBe(700_000);
    expect(result.smallDividendNoFiling!.nationalWithholdingFinalJpy?.toNumber()).toBeCloseTo(
      61_260,
      0,
    );
  });

  it("高所得帯では総合課税より申告不要のほうが有利になり得る", () => {
    const result = simulateNonListedDividendTaxation({
      nonListedDividendIncomeJpy: 1_000_000,
      smallDividendJpy: 1_000_000,
      otherTaxableIncomeJpy: 20_000_000,
    });

    expect(result.recommendedMethod).toBe("SMALL_DIVIDEND_NO_FILING");
  });

  it("低所得帯では配当控除により総合課税のほうが有利になり得る", () => {
    const result = simulateNonListedDividendTaxation({
      nonListedDividendIncomeJpy: 500_000,
      smallDividendJpy: 500_000,
      otherTaxableIncomeJpy: 1_000_000,
    });

    expect(result.recommendedMethod).toBe("REPORT_ALL");
  });

  it("少額配当該当額が配当所得金額を超える場合はエラーになる", () => {
    expect(() =>
      simulateNonListedDividendTaxation({
        nonListedDividendIncomeJpy: 500_000,
        smallDividendJpy: 600_000,
        otherTaxableIncomeJpy: 0,
      }),
    ).toThrow();
  });

  it("負の入力値はエラーになる", () => {
    expect(() =>
      simulateNonListedDividendTaxation({
        nonListedDividendIncomeJpy: -1,
        otherTaxableIncomeJpy: 0,
      }),
    ).toThrow();
    expect(() =>
      simulateNonListedDividendTaxation({
        nonListedDividendIncomeJpy: 0,
        otherTaxableIncomeJpy: -1,
      }),
    ).toThrow();
    expect(() =>
      simulateNonListedDividendTaxation({
        nonListedDividendIncomeJpy: 0,
        smallDividendJpy: -1,
        otherTaxableIncomeJpy: 0,
      }),
    ).toThrow();
  });

  it("配当控除の内訳(対象外)を指定すると総合課税で配当控除が減る", () => {
    const full = simulateNonListedDividendTaxation({
      nonListedDividendIncomeJpy: 1_000_000,
      otherTaxableIncomeJpy: 5_000_000,
    });
    const withNoCredit = simulateNonListedDividendTaxation({
      nonListedDividendIncomeJpy: 1_000_000,
      otherTaxableIncomeJpy: 5_000_000,
      dividendCreditBreakdown: { noCreditJpy: 1_000_000 },
    });

    expect(withNoCredit.reportAll.dividendCreditJpy.toNumber()).toBe(0);
    expect(withNoCredit.reportAll.totalTaxJpy.toNumber()).toBeGreaterThan(
      full.reportAll.totalTaxJpy.toNumber(),
    );
    expect(withNoCredit.notes.some((n) => n.includes("配当控除の対象外"))).toBe(true);
  });

  it("配当控除の内訳(半分税率)を指定すると通常税率より配当控除が少なくなる", () => {
    const full = simulateNonListedDividendTaxation({
      nonListedDividendIncomeJpy: 1_000_000,
      otherTaxableIncomeJpy: 5_000_000,
    });
    const halfCredit = simulateNonListedDividendTaxation({
      nonListedDividendIncomeJpy: 1_000_000,
      otherTaxableIncomeJpy: 5_000_000,
      dividendCreditBreakdown: { halfCreditJpy: 1_000_000 },
    });

    // 全額半分税率(国税5%+住民税1.4%=6.4%) < 通常税率(12.8%)
    expect(halfCredit.reportAll.dividendCreditJpy.toNumber()).toBeCloseTo(64_000, 0);
    expect(halfCredit.reportAll.dividendCreditJpy.toNumber()).toBeLessThan(
      full.reportAll.dividendCreditJpy.toNumber(),
    );
  });

  it("少額配当を申告不要にした場合、内訳は通常税率の分から優先して充当される", () => {
    const result = simulateNonListedDividendTaxation({
      nonListedDividendIncomeJpy: 1_000_000,
      smallDividendJpy: 600_000,
      otherTaxableIncomeJpy: 5_000_000,
      dividendCreditBreakdown: { noCreditJpy: 400_000 },
    });

    // 通常税率600,000円分がすべて少額配当として除外され、残る申告対象400,000円は
    // すべて配当控除の対象外(noCredit)のため、申告分の配当控除(所得税分)は0円になる
    expect(result.smallDividendNoFiling!.nationalReportedDividendJpy.toNumber()).toBe(400_000);
    expect(result.notes.some((n) => n.includes("配当控除の対象外"))).toBe(true);
  });

  it("配当控除の内訳額の合計が配当所得金額を超える場合はエラーになる", () => {
    expect(() =>
      simulateNonListedDividendTaxation({
        nonListedDividendIncomeJpy: 500_000,
        otherTaxableIncomeJpy: 0,
        dividendCreditBreakdown: { halfCreditJpy: 300_000, quarterCreditJpy: 300_000 },
      }),
    ).toThrow();
  });
});
