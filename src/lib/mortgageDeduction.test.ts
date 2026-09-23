import { describe, expect, it } from "vitest";
import { calculateMortgageDeduction } from "./mortgageDeduction";

function baseInput() {
  return {
    taxYear: 2024,
    moveInYear: 2022,
    housingCategory: "OTHER" as const,
    isExistingHome: false,
    yearEndLoanBalanceJpy: 25_000_000,
    totalIncomeJpy: 6_000_000,
  };
}

describe("calculateMortgageDeduction", () => {
  it("令和4・5年入居の新築「その他の住宅」は借入限度額3,000万円・控除期間10年になる", () => {
    const result = calculateMortgageDeduction(baseInput());

    expect(result.eligible).toBe(true);
    expect(result.borrowingLimitJpy.toNumber()).toBe(30_000_000);
    expect(result.controlPeriodYears).toBe(10);
    expect(result.controlPeriodEndYear).toBe(2031);
  });

  it("年末残高が借入限度額以下の場合は残高全額に控除率0.7%を乗じた額になる", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      yearEndLoanBalanceJpy: 25_000_000,
    });

    // 25,000,000 × 0.7% = 175,000円
    expect(result.nationalTaxCreditJpy.toNumber()).toBe(175_000);
  });

  it("年末残高が借入限度額を超える場合は限度額を基準に控除額を計算する", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      yearEndLoanBalanceJpy: 40_000_000,
    });

    // min(40,000,000, 30,000,000) × 0.7% = 210,000円
    expect(result.deductibleBalanceJpy.toNumber()).toBe(30_000_000);
    expect(result.nationalTaxCreditJpy.toNumber()).toBe(210_000);
  });

  it("控除額は100円未満を切り捨てる", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      yearEndLoanBalanceJpy: 12_345_678,
    });

    // 12,345,678 × 0.7% = 86,419.746 → 86,400円
    expect(result.nationalTaxCreditJpy.toNumber()).toBe(86_400);
  });

  it("令和4・5年入居の認定住宅は借入限度額5,000万円・控除期間13年になる", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      housingCategory: "CERTIFIED",
      yearEndLoanBalanceJpy: 60_000_000,
    });

    expect(result.borrowingLimitJpy.toNumber()).toBe(50_000_000);
    expect(result.controlPeriodYears).toBe(13);
    expect(result.controlPeriodEndYear).toBe(2034);
  });

  it("令和6・7年入居の新築「その他の住宅」は借入限度額0円で対象外になる", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      moveInYear: 2024,
      taxYear: 2024,
      housingCategory: "OTHER",
    });

    expect(result.eligible).toBe(false);
    expect(result.borrowingLimitJpy.toNumber()).toBe(0);
    expect(result.nationalTaxCreditJpy.toNumber()).toBe(0);
  });

  it("令和6・7年入居の省エネ基準適合住宅は借入限度額3,000万円になる(子育て世帯等でない場合)", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      moveInYear: 2024,
      taxYear: 2024,
      housingCategory: "ENERGY_SAVING",
    });

    expect(result.eligible).toBe(true);
    expect(result.borrowingLimitJpy.toNumber()).toBe(30_000_000);
  });

  it("令和6・7年入居でも子育て世帯等は令和4・5年入居水準の借入限度額に上乗せされる", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      moveInYear: 2024,
      taxYear: 2024,
      housingCategory: "ENERGY_SAVING",
      isChildRearingHousehold: true,
    });

    expect(result.borrowingLimitJpy.toNumber()).toBe(40_000_000);
  });

  it("子育て世帯等の上乗せは「その他の住宅」には適用されない(引き続き対象外)", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      moveInYear: 2024,
      taxYear: 2024,
      housingCategory: "OTHER",
      isChildRearingHousehold: true,
    });

    expect(result.eligible).toBe(false);
    expect(result.borrowingLimitJpy.toNumber()).toBe(0);
  });

  it("令和6・7年入居の新築「その他の住宅」は経過措置を指定すると借入限度額2,000万円・控除期間10年になる", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      moveInYear: 2024,
      taxYear: 2024,
      housingCategory: "OTHER",
      otherHousingTransitionalMeasure: true,
    });

    expect(result.eligible).toBe(true);
    expect(result.borrowingLimitJpy.toNumber()).toBe(20_000_000);
    expect(result.controlPeriodYears).toBe(10);
  });

  it("「その他の住宅」の経過措置は令和4・5年入居分には影響しない(通常通り3,000万円のまま)", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      moveInYear: 2022,
      taxYear: 2022,
      housingCategory: "OTHER",
      otherHousingTransitionalMeasure: true,
    });

    expect(result.borrowingLimitJpy.toNumber()).toBe(30_000_000);
  });

  it("「その他の住宅」の経過措置は既存住宅(中古)には影響しない(通常通り2,000万円のまま)", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      moveInYear: 2024,
      taxYear: 2024,
      housingCategory: "OTHER",
      isExistingHome: true,
      otherHousingTransitionalMeasure: true,
    });

    expect(result.borrowingLimitJpy.toNumber()).toBe(20_000_000);
  });

  it("「その他の住宅」の経過措置は省エネ基準適合住宅等には影響しない(通常通り3,000万円のまま)", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      moveInYear: 2024,
      taxYear: 2024,
      housingCategory: "ENERGY_SAVING",
      otherHousingTransitionalMeasure: true,
    });

    expect(result.borrowingLimitJpy.toNumber()).toBe(30_000_000);
  });

  it("既存住宅(中古)は認定住宅等でも借入限度額3,000万円・控除期間10年になる", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      housingCategory: "CERTIFIED",
      isExistingHome: true,
      yearEndLoanBalanceJpy: 40_000_000,
    });

    expect(result.borrowingLimitJpy.toNumber()).toBe(30_000_000);
    expect(result.controlPeriodYears).toBe(10);
  });

  it("既存住宅(中古)の「その他の住宅」は借入限度額2,000万円になる", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      housingCategory: "OTHER",
      isExistingHome: true,
      yearEndLoanBalanceJpy: 40_000_000,
    });

    expect(result.borrowingLimitJpy.toNumber()).toBe(20_000_000);
  });

  it("合計所得金額が2,000万円を超える年は適用対象外になる", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      totalIncomeJpy: 20_000_001,
    });

    expect(result.eligible).toBe(false);
    expect(result.nationalTaxCreditJpy.toNumber()).toBe(0);
  });

  it("控除期間を過ぎた年分は適用対象外になる", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      moveInYear: 2022,
      taxYear: 2032,
    });

    expect(result.eligible).toBe(false);
    expect(result.ineligibleReason).toContain("控除期間");
  });

  it("居住開始前の年分は適用対象外になる", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      moveInYear: 2024,
      taxYear: 2023,
    });

    expect(result.eligible).toBe(false);
  });

  it("居住年が令和4年〜令和7年の範囲外だとエラーになる", () => {
    expect(() =>
      calculateMortgageDeduction({ ...baseInput(), moveInYear: 2021, taxYear: 2021 }),
    ).toThrow();
    expect(() =>
      calculateMortgageDeduction({ ...baseInput(), moveInYear: 2026, taxYear: 2026 }),
    ).toThrow();
  });

  it("住民税の課税総所得金額等を指定すると控除限度額の目安(5%・上限9.75万円)を返す", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      residentTaxTaxableIncomeJpy: 3_000_000,
    });

    // 3,000,000 × 5% = 150,000円 → 上限9.75万円で頭打ち
    expect(result.residentTaxCreditLimitJpy?.toNumber()).toBe(97_500);
  });

  it("住民税の課税総所得金額等が小さい場合は5%相当額がそのまま限度額になる", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      residentTaxTaxableIncomeJpy: 1_000_000,
    });

    expect(result.residentTaxCreditLimitJpy?.toNumber()).toBe(50_000);
  });

  it("所得税額(適用前)を指定すると、控除しきれなかった額が住民税控除額になる", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      yearEndLoanBalanceJpy: 25_000_000, // 所得税の控除額175,000円
      residentTaxTaxableIncomeJpy: 3_000_000, // 限度額97,500円
      nationalIncomeTaxBeforeThisCreditJpy: 100_000,
    });

    // 175,000 - 100,000 = 75,000円(限度額97,500円以下なのでそのまま)
    expect(result.residentTaxCreditJpy?.toNumber()).toBe(75_000);
  });

  it("所得税から控除しきれなかった額が住民税の控除限度額を超える場合は限度額で頭打ちになる", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      yearEndLoanBalanceJpy: 25_000_000, // 所得税の控除額175,000円
      residentTaxTaxableIncomeJpy: 1_000_000, // 限度額50,000円
      nationalIncomeTaxBeforeThisCreditJpy: 50_000,
    });

    // 175,000 - 50,000 = 125,000円 → 限度額50,000円で頭打ち
    expect(result.residentTaxCreditJpy?.toNumber()).toBe(50_000);
  });

  it("所得税額(適用前)が控除額以上の場合は住民税への繰り越しは0円になる", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      yearEndLoanBalanceJpy: 25_000_000, // 所得税の控除額175,000円
      residentTaxTaxableIncomeJpy: 3_000_000,
      nationalIncomeTaxBeforeThisCreditJpy: 500_000,
    });

    expect(result.residentTaxCreditJpy?.toNumber()).toBe(0);
  });

  it("床面積40㎡以上50㎡未満の特例は合計所得金額1,000万円以下なら適用できる", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      isSmallFloorArea: true,
      totalIncomeJpy: 9_000_000,
    });

    expect(result.eligible).toBe(true);
  });

  it("床面積40㎡以上50㎡未満の特例は合計所得金額が1,000万円を超えると適用対象外になる(通常の2,000万円要件より厳しい)", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      isSmallFloorArea: true,
      totalIncomeJpy: 15_000_000,
    });

    expect(result.eligible).toBe(false);
    expect(result.ineligibleReason).toContain("1,000万円");
  });

  it("床面積40㎡以上50㎡未満の特例を指定しない場合は従来通り2,000万円まで適用できる", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      totalIncomeJpy: 15_000_000,
    });

    expect(result.eligible).toBe(true);
  });

  it("床面積40㎡以上50㎡未満の特例は既存住宅(中古)には適用されない(通常の2,000万円要件のまま)", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      isExistingHome: true,
      isSmallFloorArea: true,
      totalIncomeJpy: 15_000_000,
    });

    expect(result.eligible).toBe(true);
  });

  it("負の値を入力するとエラーになる", () => {
    expect(() =>
      calculateMortgageDeduction({ ...baseInput(), yearEndLoanBalanceJpy: -1 }),
    ).toThrow();
    expect(() =>
      calculateMortgageDeduction({ ...baseInput(), totalIncomeJpy: -1 }),
    ).toThrow();
  });

  it("連帯債務の負担割合を指定すると、年末残高の合計額を按分した金額が本人の年末残高になる", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      yearEndLoanBalanceJpy: 40_000_000, // 連帯債務者全員分の合計額
      jointDebtShareRatioPercent: 60,
    });

    // 40,000,000 × 60% = 24,000,000円(借入限度額3,000万円以下なのでそのまま)
    expect(result.ownYearEndLoanBalanceJpy.toNumber()).toBe(24_000_000);
    expect(result.deductibleBalanceJpy.toNumber()).toBe(24_000_000);
    // 24,000,000 × 0.7% = 168,000円
    expect(result.nationalTaxCreditJpy.toNumber()).toBe(168_000);
  });

  it("連帯債務按分後の本人負担額が借入限度額を超える場合は限度額を基準に計算する", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      yearEndLoanBalanceJpy: 80_000_000,
      jointDebtShareRatioPercent: 50,
    });

    // 80,000,000 × 50% = 40,000,000円 > 借入限度額3,000万円
    expect(result.ownYearEndLoanBalanceJpy.toNumber()).toBe(40_000_000);
    expect(result.deductibleBalanceJpy.toNumber()).toBe(30_000_000);
    expect(result.nationalTaxCreditJpy.toNumber()).toBe(210_000);
  });

  it("連帯債務の負担割合を指定しない場合は年末残高をそのまま本人負担分として扱う(従来通り)", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      yearEndLoanBalanceJpy: 25_000_000,
    });

    expect(result.ownYearEndLoanBalanceJpy.toNumber()).toBe(25_000_000);
  });

  it("連帯債務の負担割合が0%以下または100%超だとエラーになる", () => {
    expect(() =>
      calculateMortgageDeduction({ ...baseInput(), jointDebtShareRatioPercent: 0 }),
    ).toThrow();
    expect(() =>
      calculateMortgageDeduction({ ...baseInput(), jointDebtShareRatioPercent: -10 }),
    ).toThrow();
    expect(() =>
      calculateMortgageDeduction({ ...baseInput(), jointDebtShareRatioPercent: 100.5 }),
    ).toThrow();
  });

  it("連帯債務の負担割合100%は単独債務と同じ結果になる", () => {
    const result = calculateMortgageDeduction({
      ...baseInput(),
      yearEndLoanBalanceJpy: 25_000_000,
      jointDebtShareRatioPercent: 100,
    });

    expect(result.ownYearEndLoanBalanceJpy.toNumber()).toBe(25_000_000);
    expect(result.nationalTaxCreditJpy.toNumber()).toBe(175_000);
  });
});
