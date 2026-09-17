import { describe, expect, it } from "vitest";
import { estimateEarthquakeInsuranceDeduction } from "./earthquakeInsuranceDeduction";

function emptyInput() {
  return { earthquakePremiumJpy: 0, oldLongTermPremiumJpy: 0 };
}

describe("estimateEarthquakeInsuranceDeduction", () => {
  it("地震保険料は全額が所得税の控除額になる(上限5万円以下の場合)", () => {
    const result = estimateEarthquakeInsuranceDeduction({
      ...emptyInput(),
      earthquakePremiumJpy: 30_000,
    });

    expect(result.earthquakeIncomeTaxDeductionJpy.toNumber()).toBe(30_000);
  });

  it("地震保険料が5万円超の場合は所得税の控除額は上限5万円になる", () => {
    const result = estimateEarthquakeInsuranceDeduction({
      ...emptyInput(),
      earthquakePremiumJpy: 100_000,
    });

    expect(result.earthquakeIncomeTaxDeductionJpy.toNumber()).toBe(50_000);
  });

  it("地震保険料の住民税控除額は支払保険料の1/2(上限2.5万円)になる", () => {
    const result = estimateEarthquakeInsuranceDeduction({
      ...emptyInput(),
      earthquakePremiumJpy: 30_000,
    });

    expect(result.earthquakeResidentTaxDeductionJpy.toNumber()).toBe(15_000);
  });

  it("地震保険料が5万円超の場合でも住民税の控除額は上限2.5万円になる", () => {
    const result = estimateEarthquakeInsuranceDeduction({
      ...emptyInput(),
      earthquakePremiumJpy: 100_000,
    });

    expect(result.earthquakeResidentTaxDeductionJpy.toNumber()).toBe(25_000);
  });

  it("旧長期損害保険料は速算表どおりに所得税の控除額を計算する(1万円超2万円以下)", () => {
    const result = estimateEarthquakeInsuranceDeduction({
      ...emptyInput(),
      oldLongTermPremiumJpy: 16_000,
    });

    // 16,000 × 1/2 + 5,000 = 13,000円
    expect(result.oldLongTermIncomeTaxDeductionJpy.toNumber()).toBe(13_000);
  });

  it("旧長期損害保険料が2万円超の場合は所得税の控除額は上限1.5万円になる", () => {
    const result = estimateEarthquakeInsuranceDeduction({
      ...emptyInput(),
      oldLongTermPremiumJpy: 50_000,
    });

    expect(result.oldLongTermIncomeTaxDeductionJpy.toNumber()).toBe(15_000);
  });

  it("旧長期損害保険料は速算表どおりに住民税の控除額を計算する(5千円超1.5万円以下)", () => {
    const result = estimateEarthquakeInsuranceDeduction({
      ...emptyInput(),
      oldLongTermPremiumJpy: 10_000,
    });

    // 10,000 × 1/2 + 2,500 = 7,500円
    expect(result.oldLongTermResidentTaxDeductionJpy.toNumber()).toBe(7_500);
  });

  it("旧長期損害保険料が1.5万円超の場合は住民税の控除額は上限1万円になる", () => {
    const result = estimateEarthquakeInsuranceDeduction({
      ...emptyInput(),
      oldLongTermPremiumJpy: 50_000,
    });

    expect(result.oldLongTermResidentTaxDeductionJpy.toNumber()).toBe(10_000);
  });

  it("地震保険料と旧長期損害保険料の両方がある場合は合算した控除額になる(所得税)", () => {
    const result = estimateEarthquakeInsuranceDeduction({
      earthquakePremiumJpy: 30_000,
      oldLongTermPremiumJpy: 16_000,
    });

    // 30,000(地震) + 13,000(旧長期) = 43,000円
    expect(result.totalIncomeTaxDeductionJpy.toNumber()).toBe(43_000);
  });

  it("合算額が上限5万円を超える場合は所得税の合計控除額は上限5万円で頭打ちになる", () => {
    const result = estimateEarthquakeInsuranceDeduction({
      earthquakePremiumJpy: 50_000,
      oldLongTermPremiumJpy: 50_000,
    });

    expect(result.totalIncomeTaxDeductionJpy.toNumber()).toBe(50_000);
  });

  it("合算額が上限2.5万円を超える場合は住民税の合計控除額は上限2.5万円で頭打ちになる", () => {
    const result = estimateEarthquakeInsuranceDeduction({
      earthquakePremiumJpy: 50_000,
      oldLongTermPremiumJpy: 50_000,
    });

    expect(result.totalResidentTaxDeductionJpy.toNumber()).toBe(25_000);
  });

  it("入力が0の場合は控除額も0になる", () => {
    const result = estimateEarthquakeInsuranceDeduction(emptyInput());

    expect(result.totalIncomeTaxDeductionJpy.toNumber()).toBe(0);
    expect(result.totalResidentTaxDeductionJpy.toNumber()).toBe(0);
  });

  it("負の値を入力するとエラーになる", () => {
    expect(() =>
      estimateEarthquakeInsuranceDeduction({
        earthquakePremiumJpy: -1,
        oldLongTermPremiumJpy: 0,
      }),
    ).toThrow();
  });
});
