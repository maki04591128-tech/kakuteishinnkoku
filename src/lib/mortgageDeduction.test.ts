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

  it("居住年が令和4年〜令和12年の範囲外だとエラーになる", () => {
    expect(() =>
      calculateMortgageDeduction({ ...baseInput(), moveInYear: 2021, taxYear: 2021 }),
    ).toThrow();
    expect(() =>
      calculateMortgageDeduction({ ...baseInput(), moveInYear: 2031, taxYear: 2031 }),
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

  describe("連帯債務の負担割合と持分割合が異なる場合の取得対価相当額による上限(国税庁質疑応答事例)", () => {
    // 国税庁質疑応答事例「共有の家屋を連帯債務により取得した場合の借入金の額の計算」の
    // 設例をそのまま検証する。家屋等の取得対価4,500万円(夫婦2分の1ずつの共有)、
    // 頭金500万円、連帯債務(借入金)4,000万円、負担割合は夫6:妻4。
    it("設例1: 頭金を持分割合(50%ずつ)で負担した場合、夫は2,000万円・妻は1,600万円に制限される", () => {
      const husband = calculateMortgageDeduction({
        ...baseInput(),
        yearEndLoanBalanceJpy: 40_000_000,
        jointDebtShareRatioPercent: 60,
        jointDebtAcquisitionPriceJpy: 45_000_000,
        jointDebtOwnershipSharePercent: 50,
        jointDebtOwnFundsJpy: 2_500_000, // 頭金500万円のうち持分割合(50%)に応じた負担分
      });
      // 按分額 4,000万×60%=2,400万円 > 持分相当額 4,500万×50%-250万=2,000万円
      expect(husband.ownYearEndLoanBalanceJpy.toNumber()).toBe(20_000_000);

      const wife = calculateMortgageDeduction({
        ...baseInput(),
        yearEndLoanBalanceJpy: 40_000_000,
        jointDebtShareRatioPercent: 40,
        jointDebtAcquisitionPriceJpy: 45_000_000,
        jointDebtOwnershipSharePercent: 50,
        jointDebtOwnFundsJpy: 2_500_000,
      });
      // 按分額 4,000万×40%=1,600万円 <= 持分相当額 4,500万×50%-250万=2,000万円(上限は効かない)
      expect(wife.ownYearEndLoanBalanceJpy.toNumber()).toBe(16_000_000);
    });

    it("設例2: 頭金を夫が1人で負担した場合、夫は1,750万円に制限され、妻は按分額1,600万円のままになる", () => {
      const husband = calculateMortgageDeduction({
        ...baseInput(),
        yearEndLoanBalanceJpy: 40_000_000,
        jointDebtShareRatioPercent: 60,
        jointDebtAcquisitionPriceJpy: 45_000_000,
        jointDebtOwnershipSharePercent: 50,
        jointDebtOwnFundsJpy: 5_000_000,
      });
      // 按分額 4,000万×60%=2,400万円 > 持分相当額 4,500万×50%-500万=1,750万円
      expect(husband.ownYearEndLoanBalanceJpy.toNumber()).toBe(17_500_000);

      const wife = calculateMortgageDeduction({
        ...baseInput(),
        yearEndLoanBalanceJpy: 40_000_000,
        jointDebtShareRatioPercent: 40,
        jointDebtAcquisitionPriceJpy: 45_000_000,
        jointDebtOwnershipSharePercent: 50,
        jointDebtOwnFundsJpy: 0,
      });
      // 按分額 4,000万×40%=1,600万円 <= 持分相当額 4,500万×50%-0=2,250万円(上限は効かない)
      expect(wife.ownYearEndLoanBalanceJpy.toNumber()).toBe(16_000_000);
    });

    it("取得対価の総額と持分割合の両方を指定しないと上限判定は行われない", () => {
      const result = calculateMortgageDeduction({
        ...baseInput(),
        yearEndLoanBalanceJpy: 40_000_000,
        jointDebtShareRatioPercent: 60,
      });

      expect(result.ownYearEndLoanBalanceJpy.toNumber()).toBe(24_000_000);
    });

    it("取得対価の総額・持分割合のいずれか一方だけを指定するとエラーになる", () => {
      expect(() =>
        calculateMortgageDeduction({
          ...baseInput(),
          yearEndLoanBalanceJpy: 40_000_000,
          jointDebtShareRatioPercent: 60,
          jointDebtAcquisitionPriceJpy: 45_000_000,
        }),
      ).toThrow();
      expect(() =>
        calculateMortgageDeduction({
          ...baseInput(),
          yearEndLoanBalanceJpy: 40_000_000,
          jointDebtShareRatioPercent: 60,
          jointDebtOwnershipSharePercent: 50,
        }),
      ).toThrow();
    });

    it("持分割合が0%以下または100%超だとエラーになる", () => {
      expect(() =>
        calculateMortgageDeduction({
          ...baseInput(),
          jointDebtShareRatioPercent: 60,
          jointDebtAcquisitionPriceJpy: 45_000_000,
          jointDebtOwnershipSharePercent: 0,
        }),
      ).toThrow();
      expect(() =>
        calculateMortgageDeduction({
          ...baseInput(),
          jointDebtShareRatioPercent: 60,
          jointDebtAcquisitionPriceJpy: 45_000_000,
          jointDebtOwnershipSharePercent: 100.5,
        }),
      ).toThrow();
    });
  });

  describe("令和8年(2026年)〜令和12年(2030年)入居分(令和8年度税制改正)", () => {
    it("新築の認定住宅(長期優良・低炭素)は借入限度額4,500万円・控除期間13年になる", () => {
      const result = calculateMortgageDeduction({
        ...baseInput(),
        moveInYear: 2026,
        taxYear: 2026,
        housingCategory: "CERTIFIED",
        yearEndLoanBalanceJpy: 50_000_000,
      });

      expect(result.eligible).toBe(true);
      expect(result.borrowingLimitJpy.toNumber()).toBe(45_000_000);
      expect(result.controlPeriodYears).toBe(13);
      expect(result.controlPeriodEndYear).toBe(2038);
    });

    it("新築の認定住宅は子育て世帯等だと借入限度額5,000万円に上乗せされる", () => {
      const result = calculateMortgageDeduction({
        ...baseInput(),
        moveInYear: 2026,
        taxYear: 2026,
        housingCategory: "CERTIFIED",
        isChildRearingHousehold: true,
        yearEndLoanBalanceJpy: 60_000_000,
      });

      expect(result.borrowingLimitJpy.toNumber()).toBe(50_000_000);
    });

    it("新築のZEH水準省エネ住宅は借入限度額3,500万円(子育て世帯等4,500万円)になる", () => {
      const normal = calculateMortgageDeduction({
        ...baseInput(),
        moveInYear: 2027,
        taxYear: 2027,
        housingCategory: "ZEH",
        yearEndLoanBalanceJpy: 50_000_000,
      });
      const childRearing = calculateMortgageDeduction({
        ...baseInput(),
        moveInYear: 2027,
        taxYear: 2027,
        housingCategory: "ZEH",
        isChildRearingHousehold: true,
        yearEndLoanBalanceJpy: 50_000_000,
      });

      expect(normal.borrowingLimitJpy.toNumber()).toBe(35_000_000);
      expect(childRearing.borrowingLimitJpy.toNumber()).toBe(45_000_000);
    });

    it("新築の省エネ基準適合住宅は令和8・9年入居分は借入限度額2,000万円(子育て世帯等3,000万円)になる", () => {
      const normal = calculateMortgageDeduction({
        ...baseInput(),
        moveInYear: 2027,
        taxYear: 2027,
        housingCategory: "ENERGY_SAVING",
        yearEndLoanBalanceJpy: 30_000_000,
      });
      const childRearing = calculateMortgageDeduction({
        ...baseInput(),
        moveInYear: 2027,
        taxYear: 2027,
        housingCategory: "ENERGY_SAVING",
        isChildRearingHousehold: true,
        yearEndLoanBalanceJpy: 30_000_000,
      });

      expect(normal.eligible).toBe(true);
      expect(normal.borrowingLimitJpy.toNumber()).toBe(20_000_000);
      expect(normal.controlPeriodYears).toBe(13);
      expect(childRearing.borrowingLimitJpy.toNumber()).toBe(30_000_000);
    });

    it("新築の省エネ基準適合住宅は令和10年(2028年)以降入居分は原則対象外になる", () => {
      const result = calculateMortgageDeduction({
        ...baseInput(),
        moveInYear: 2028,
        taxYear: 2028,
        housingCategory: "ENERGY_SAVING",
      });

      expect(result.eligible).toBe(false);
      expect(result.borrowingLimitJpy.toNumber()).toBe(0);
    });

    it("新築の省エネ基準適合住宅は令和10年以降入居でも経過措置を指定すると借入限度額2,000万円・控除期間10年になる", () => {
      const result = calculateMortgageDeduction({
        ...baseInput(),
        moveInYear: 2029,
        taxYear: 2029,
        housingCategory: "ENERGY_SAVING",
        energySavingTransitionalMeasure: true,
        yearEndLoanBalanceJpy: 25_000_000,
      });

      expect(result.eligible).toBe(true);
      expect(result.borrowingLimitJpy.toNumber()).toBe(20_000_000);
      expect(result.controlPeriodYears).toBe(10);
    });

    it("省エネ基準適合住宅の経過措置は子育て世帯等の上乗せ措置と併用できない(上乗せなしの2,000万円のまま)", () => {
      const result = calculateMortgageDeduction({
        ...baseInput(),
        moveInYear: 2029,
        taxYear: 2029,
        housingCategory: "ENERGY_SAVING",
        energySavingTransitionalMeasure: true,
        isChildRearingHousehold: true,
        yearEndLoanBalanceJpy: 25_000_000,
      });

      expect(result.borrowingLimitJpy.toNumber()).toBe(20_000_000);
    });

    it("省エネ基準適合住宅の経過措置は令和9年以前入居分には影響しない", () => {
      const result = calculateMortgageDeduction({
        ...baseInput(),
        moveInYear: 2027,
        taxYear: 2027,
        housingCategory: "ENERGY_SAVING",
        energySavingTransitionalMeasure: true,
        yearEndLoanBalanceJpy: 30_000_000,
      });

      expect(result.borrowingLimitJpy.toNumber()).toBe(20_000_000);
    });

    it("新築の「その他の住宅」は原則対象外だが経過措置を指定すると借入限度額2,000万円・控除期間10年になる", () => {
      const ineligible = calculateMortgageDeduction({
        ...baseInput(),
        moveInYear: 2026,
        taxYear: 2026,
        housingCategory: "OTHER",
      });
      const transitional = calculateMortgageDeduction({
        ...baseInput(),
        moveInYear: 2026,
        taxYear: 2026,
        housingCategory: "OTHER",
        otherHousingTransitionalMeasure: true,
        yearEndLoanBalanceJpy: 25_000_000,
      });

      expect(ineligible.eligible).toBe(false);
      expect(transitional.eligible).toBe(true);
      expect(transitional.borrowingLimitJpy.toNumber()).toBe(20_000_000);
      expect(transitional.controlPeriodYears).toBe(10);
    });

    it("既存住宅(中古)の認定住宅・ZEH水準省エネ住宅は借入限度額3,500万円(子育て世帯等4,500万円)・控除期間13年になる", () => {
      const normal = calculateMortgageDeduction({
        ...baseInput(),
        moveInYear: 2026,
        taxYear: 2026,
        housingCategory: "CERTIFIED",
        isExistingHome: true,
        yearEndLoanBalanceJpy: 40_000_000,
      });
      const childRearing = calculateMortgageDeduction({
        ...baseInput(),
        moveInYear: 2026,
        taxYear: 2026,
        housingCategory: "ZEH",
        isExistingHome: true,
        isChildRearingHousehold: true,
        yearEndLoanBalanceJpy: 50_000_000,
      });

      expect(normal.borrowingLimitJpy.toNumber()).toBe(35_000_000);
      expect(normal.controlPeriodYears).toBe(13);
      expect(childRearing.borrowingLimitJpy.toNumber()).toBe(45_000_000);
    });

    it("既存住宅(中古)の省エネ基準適合住宅は借入限度額2,000万円(子育て世帯等3,000万円)・控除期間13年になる", () => {
      const result = calculateMortgageDeduction({
        ...baseInput(),
        moveInYear: 2026,
        taxYear: 2026,
        housingCategory: "ENERGY_SAVING",
        isExistingHome: true,
        yearEndLoanBalanceJpy: 25_000_000,
      });

      expect(result.borrowingLimitJpy.toNumber()).toBe(20_000_000);
      expect(result.controlPeriodYears).toBe(13);
    });

    it("既存住宅(中古)の「その他の住宅」は借入限度額2,000万円・控除期間10年のまま(子育て世帯等の上乗せなし)", () => {
      const result = calculateMortgageDeduction({
        ...baseInput(),
        moveInYear: 2026,
        taxYear: 2026,
        housingCategory: "OTHER",
        isExistingHome: true,
        isChildRearingHousehold: true,
        yearEndLoanBalanceJpy: 25_000_000,
      });

      expect(result.borrowingLimitJpy.toNumber()).toBe(20_000_000);
      expect(result.controlPeriodYears).toBe(10);
    });

    it("床面積40㎡以上50㎡未満の特例と子育て世帯等の上乗せ措置は同時に適用できない(対象外)", () => {
      const result = calculateMortgageDeduction({
        ...baseInput(),
        moveInYear: 2026,
        taxYear: 2026,
        housingCategory: "CERTIFIED",
        isSmallFloorArea: true,
        isChildRearingHousehold: true,
        totalIncomeJpy: 5_000_000,
      });

      expect(result.eligible).toBe(false);
      expect(result.ineligibleReason).toContain("床面積");
    });

    it("床面積40㎡以上50㎡未満の特例のみ(子育て世帯等でない)は令和8年以降も従来通り所得1,000万円要件で適用できる", () => {
      const result = calculateMortgageDeduction({
        ...baseInput(),
        moveInYear: 2026,
        taxYear: 2026,
        housingCategory: "CERTIFIED",
        isSmallFloorArea: true,
        totalIncomeJpy: 10_000_000,
        yearEndLoanBalanceJpy: 30_000_000,
      });

      expect(result.eligible).toBe(true);
      expect(result.borrowingLimitJpy.toNumber()).toBe(45_000_000);
    });

    it("令和12年(2030年)入居分まで対応する", () => {
      const result = calculateMortgageDeduction({
        ...baseInput(),
        moveInYear: 2030,
        taxYear: 2030,
        housingCategory: "ZEH",
        yearEndLoanBalanceJpy: 35_000_000,
      });

      expect(result.eligible).toBe(true);
      expect(result.borrowingLimitJpy.toNumber()).toBe(35_000_000);
      expect(result.controlPeriodEndYear).toBe(2042);
    });
  });
});
