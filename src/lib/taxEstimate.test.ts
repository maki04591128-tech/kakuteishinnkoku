import { describe, expect, it } from "vitest";
import { estimateTotalTax } from "./taxEstimate";

describe("estimateTotalTax", () => {
  it("暗号資産の雑所得は給与所得等と合算した累進税率で課税される", () => {
    const withoutCrypto = estimateTotalTax({
      otherComprehensiveIncomeJpy: 5_000_000,
      cryptoMiscIncomeJpy: 0,
      investmentTaxableGainJpy: 0,
      futuresTaxableGainJpy: 0,
      dividendIncomeJpy: 0,
    });
    const withCrypto = estimateTotalTax({
      otherComprehensiveIncomeJpy: 5_000_000,
      cryptoMiscIncomeJpy: 1_000_000,
      investmentTaxableGainJpy: 0,
      futuresTaxableGainJpy: 0,
      dividendIncomeJpy: 0,
    });

    // 5,000,000円は20%帯・6,000,000円も20%帯のため、増分は単純に100万円×20%×1.021
    expect(
      withCrypto.comprehensiveNationalTaxJpy.minus(withoutCrypto.comprehensiveNationalTaxJpy).toNumber(),
    ).toBeCloseTo(1_000_000 * 0.2 * 1.021, 0);
    expect(
      withCrypto.comprehensiveResidentTaxJpy.minus(withoutCrypto.comprehensiveResidentTaxJpy).toNumber(),
    ).toBe(100_000);
  });

  it("株式等の譲渡所得・先物の雑所得等はそれぞれ20.315%の申告分離課税", () => {
    const result = estimateTotalTax({
      otherComprehensiveIncomeJpy: 0,
      cryptoMiscIncomeJpy: 0,
      investmentTaxableGainJpy: 1_000_000,
      futuresTaxableGainJpy: 2_000_000,
      dividendIncomeJpy: 0,
    });

    expect(result.investmentNationalTaxJpy.plus(result.investmentResidentTaxJpy).toNumber()).toBeCloseTo(
      1_000_000 * 0.20315,
      0,
    );
    expect(result.futuresNationalTaxJpy.plus(result.futuresResidentTaxJpy).toNumber()).toBeCloseTo(
      2_000_000 * 0.20315,
      0,
    );
  });

  it("配当所得の課税方式は指定しなければ最も有利な方式が自動選択される", () => {
    const result = estimateTotalTax({
      otherComprehensiveIncomeJpy: 1_000_000,
      cryptoMiscIncomeJpy: 0,
      investmentTaxableGainJpy: 0,
      futuresTaxableGainJpy: 0,
      dividendIncomeJpy: 500_000,
    });

    expect(result.dividendMethodUsed).toBe(result.dividend.recommendedMethod);
    expect(result.dividendMethodUsed).toBe("COMPREHENSIVE");
  });

  it("配当所得の課税方式を明示的に指定するとその方式で合計税額が計算される", () => {
    const result = estimateTotalTax({
      otherComprehensiveIncomeJpy: 1_000_000,
      cryptoMiscIncomeJpy: 0,
      investmentTaxableGainJpy: 0,
      futuresTaxableGainJpy: 0,
      dividendIncomeJpy: 500_000,
      dividendMethod: "NO_FILING",
    });

    expect(result.dividendMethodUsed).toBe("NO_FILING");
    expect(
      result.totalNationalTaxJpy
        .plus(result.totalResidentTaxJpy)
        .minus(result.comprehensiveNationalTaxJpy)
        .minus(result.comprehensiveResidentTaxJpy)
        .toNumber(),
    ).toBeCloseTo(result.dividend.noFiling.totalTaxJpy.toNumber(), 6);
  });

  it("申告分離課税での配当と譲渡損失の損益通算を反映できる", () => {
    const result = estimateTotalTax({
      otherComprehensiveIncomeJpy: 5_000_000,
      cryptoMiscIncomeJpy: 0,
      investmentTaxableGainJpy: 0,
      futuresTaxableGainJpy: 0,
      dividendIncomeJpy: 1_000_000,
      dividendMethod: "SEPARATE",
      availableListedStockLossForDividendJpy: 700_000,
    });

    expect(result.dividend.separate.lossOffsetUsedJpy?.toNumber()).toBe(700_000);
    expect(result.dividend.separate.taxableDividendJpy.toNumber()).toBe(300_000);
  });

  it("合計税額は各区分の所得税・住民税の単純合計になる", () => {
    const result = estimateTotalTax({
      otherComprehensiveIncomeJpy: 3_000_000,
      cryptoMiscIncomeJpy: 500_000,
      investmentTaxableGainJpy: 1_000_000,
      futuresTaxableGainJpy: 500_000,
      dividendIncomeJpy: 200_000,
    });

    expect(result.totalNationalTaxJpy.toNumber()).toBeCloseTo(
      result.comprehensiveNationalTaxJpy
        .plus(result.dividendResultUsed.nationalTaxJpy)
        .plus(result.investmentNationalTaxJpy)
        .plus(result.futuresNationalTaxJpy)
        .toNumber(),
      6,
    );
    expect(result.totalTaxJpy.toNumber()).toBeCloseTo(
      result.totalNationalTaxJpy.plus(result.totalResidentTaxJpy).toNumber(),
      6,
    );
  });

  it("負の入力値はエラーになる", () => {
    expect(() =>
      estimateTotalTax({
        otherComprehensiveIncomeJpy: -1,
        cryptoMiscIncomeJpy: 0,
        investmentTaxableGainJpy: 0,
        futuresTaxableGainJpy: 0,
        dividendIncomeJpy: 0,
      }),
    ).toThrow();
  });
});
