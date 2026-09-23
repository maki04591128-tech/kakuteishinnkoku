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

  it("住宅ローン控除(税額控除)を入力すると合計税額から直接差し引かれる", () => {
    const without = estimateTotalTax({
      otherComprehensiveIncomeJpy: 5_000_000,
      cryptoMiscIncomeJpy: 0,
      investmentTaxableGainJpy: 0,
      futuresTaxableGainJpy: 0,
      dividendIncomeJpy: 0,
    });
    const withMortgage = estimateTotalTax({
      otherComprehensiveIncomeJpy: 5_000_000,
      cryptoMiscIncomeJpy: 0,
      investmentTaxableGainJpy: 0,
      futuresTaxableGainJpy: 0,
      dividendIncomeJpy: 0,
      mortgageDeductionNationalTaxCreditJpy: 100_000,
      mortgageDeductionResidentTaxCreditJpy: 20_000,
    });

    expect(
      without.totalNationalTaxJpy.minus(withMortgage.totalNationalTaxJpy).toNumber(),
    ).toBe(100_000);
    expect(
      without.totalResidentTaxJpy.minus(withMortgage.totalResidentTaxJpy).toNumber(),
    ).toBe(20_000);
    expect(withMortgage.mortgageDeductionNationalTaxAppliedJpy.toNumber()).toBe(100_000);
    expect(withMortgage.mortgageDeductionResidentTaxAppliedJpy.toNumber()).toBe(20_000);
    expect(withMortgage.totalTaxJpy.toNumber()).toBe(
      without.totalTaxJpy.toNumber() - 120_000,
    );
  });

  it("住宅ローン控除額がその年の税額を上回る場合は0円が下限になる(還付は生じない)", () => {
    const result = estimateTotalTax({
      otherComprehensiveIncomeJpy: 500_000,
      cryptoMiscIncomeJpy: 0,
      investmentTaxableGainJpy: 0,
      futuresTaxableGainJpy: 0,
      dividendIncomeJpy: 0,
      mortgageDeductionNationalTaxCreditJpy: 100_000_000,
      mortgageDeductionResidentTaxCreditJpy: 100_000_000,
    });

    expect(result.totalNationalTaxJpy.toNumber()).toBe(0);
    expect(result.totalResidentTaxJpy.toNumber()).toBe(0);
    expect(result.mortgageDeductionNationalTaxAppliedJpy.toNumber()).toBe(
      result.totalNationalTaxBeforeMortgageDeductionJpy.toNumber(),
    );
    expect(result.mortgageDeductionResidentTaxAppliedJpy.toNumber()).toBe(
      result.totalResidentTaxBeforeMortgageDeductionJpy.toNumber(),
    );
  });

  it("外国税額控除(税額控除)を入力すると住宅ローン控除適用後の税額から直接差し引かれる", () => {
    const withMortgageOnly = estimateTotalTax({
      otherComprehensiveIncomeJpy: 5_000_000,
      cryptoMiscIncomeJpy: 0,
      investmentTaxableGainJpy: 0,
      futuresTaxableGainJpy: 0,
      dividendIncomeJpy: 0,
      mortgageDeductionNationalTaxCreditJpy: 100_000,
      mortgageDeductionResidentTaxCreditJpy: 20_000,
    });
    const withBoth = estimateTotalTax({
      otherComprehensiveIncomeJpy: 5_000_000,
      cryptoMiscIncomeJpy: 0,
      investmentTaxableGainJpy: 0,
      futuresTaxableGainJpy: 0,
      dividendIncomeJpy: 0,
      mortgageDeductionNationalTaxCreditJpy: 100_000,
      mortgageDeductionResidentTaxCreditJpy: 20_000,
      foreignTaxCreditNationalTaxCreditJpy: 30_000,
      foreignTaxCreditResidentTaxCreditJpy: 9_000,
    });

    expect(
      withMortgageOnly.totalNationalTaxJpy.minus(withBoth.totalNationalTaxJpy).toNumber(),
    ).toBe(30_000);
    expect(
      withMortgageOnly.totalResidentTaxJpy.minus(withBoth.totalResidentTaxJpy).toNumber(),
    ).toBe(9_000);
    expect(withBoth.foreignTaxCreditNationalTaxAppliedJpy.toNumber()).toBe(30_000);
    expect(withBoth.foreignTaxCreditResidentTaxAppliedJpy.toNumber()).toBe(9_000);
    expect(withBoth.totalTaxJpy.toNumber()).toBe(
      withMortgageOnly.totalTaxJpy.toNumber() - 39_000,
    );
  });

  it("外国税額控除額が住宅ローン控除適用後の税額を上回る場合は0円が下限になる(還付は生じない)", () => {
    const result = estimateTotalTax({
      otherComprehensiveIncomeJpy: 500_000,
      cryptoMiscIncomeJpy: 0,
      investmentTaxableGainJpy: 0,
      futuresTaxableGainJpy: 0,
      dividendIncomeJpy: 0,
      foreignTaxCreditNationalTaxCreditJpy: 100_000_000,
      foreignTaxCreditResidentTaxCreditJpy: 100_000_000,
    });

    expect(result.totalNationalTaxJpy.toNumber()).toBe(0);
    expect(result.totalResidentTaxJpy.toNumber()).toBe(0);
    expect(result.foreignTaxCreditNationalTaxAppliedJpy.toNumber()).toBe(
      result.totalNationalTaxAfterMortgageDeductionJpy.toNumber(),
    );
    expect(result.foreignTaxCreditResidentTaxAppliedJpy.toNumber()).toBe(
      result.totalResidentTaxAfterMortgageDeductionJpy.toNumber(),
    );
  });

  it("ふるさと納税の上限額は住宅ローン控除適用前の住民税所得割額を基準に試算する", () => {
    const without = estimateTotalTax({
      otherComprehensiveIncomeJpy: 5_000_000,
      cryptoMiscIncomeJpy: 0,
      investmentTaxableGainJpy: 0,
      futuresTaxableGainJpy: 0,
      dividendIncomeJpy: 0,
    });
    const withMortgage = estimateTotalTax({
      otherComprehensiveIncomeJpy: 5_000_000,
      cryptoMiscIncomeJpy: 0,
      investmentTaxableGainJpy: 0,
      futuresTaxableGainJpy: 0,
      dividendIncomeJpy: 0,
      mortgageDeductionNationalTaxCreditJpy: 100_000,
      mortgageDeductionResidentTaxCreditJpy: 20_000,
    });

    expect(withMortgage.furusatoNozei.fullDeductionDonationLimitJpy.toNumber()).toBe(
      without.furusatoNozei.fullDeductionDonationLimitJpy.toNumber(),
    );
  });

  it("源泉徴収税額を入力すると納付・還付見込み額が試算される", () => {
    const result = estimateTotalTax({
      otherComprehensiveIncomeJpy: 0,
      cryptoMiscIncomeJpy: 0,
      investmentTaxableGainJpy: 1_000_000,
      futuresTaxableGainJpy: 0,
      dividendIncomeJpy: 0,
      withheldNationalTaxJpy: 100_000,
      withheldResidentTaxJpy: 30_000,
    });

    expect(result.nationalTaxBalanceJpy.toNumber()).toBeCloseTo(
      result.totalNationalTaxJpy.toNumber() - 100_000,
      6,
    );
    expect(result.residentTaxBalanceJpy.toNumber()).toBeCloseTo(
      result.totalResidentTaxJpy.toNumber() - 30_000,
      6,
    );
    expect(result.totalTaxBalanceJpy.toNumber()).toBeCloseTo(
      result.nationalTaxBalanceJpy.toNumber() + result.residentTaxBalanceJpy.toNumber(),
      6,
    );
  });

  it("源泉徴収税額が税額を上回る場合は還付見込み額としてマイナスになる", () => {
    const result = estimateTotalTax({
      otherComprehensiveIncomeJpy: 0,
      cryptoMiscIncomeJpy: 0,
      investmentTaxableGainJpy: 100_000,
      futuresTaxableGainJpy: 0,
      dividendIncomeJpy: 0,
      withheldNationalTaxJpy: 1_000_000,
      withheldResidentTaxJpy: 0,
    });

    expect(result.nationalTaxBalanceJpy.isNegative()).toBe(true);
    expect(result.totalTaxBalanceJpy.isNegative()).toBe(true);
  });

  it("源泉徴収税額を入力しない場合、納付見込み額は合計税額と一致する", () => {
    const result = estimateTotalTax({
      otherComprehensiveIncomeJpy: 3_000_000,
      cryptoMiscIncomeJpy: 500_000,
      investmentTaxableGainJpy: 1_000_000,
      futuresTaxableGainJpy: 0,
      dividendIncomeJpy: 0,
    });

    expect(result.withheldNationalTaxJpy.toNumber()).toBe(0);
    expect(result.withheldResidentTaxJpy.toNumber()).toBe(0);
    expect(result.totalTaxBalanceJpy.toNumber()).toBeCloseTo(result.totalTaxJpy.toNumber(), 6);
  });

  it("予定納税額を入力すると所得税等の納付・還付見込み額からのみ差し引かれる", () => {
    const result = estimateTotalTax({
      otherComprehensiveIncomeJpy: 0,
      cryptoMiscIncomeJpy: 0,
      investmentTaxableGainJpy: 1_000_000,
      futuresTaxableGainJpy: 0,
      dividendIncomeJpy: 0,
      withheldNationalTaxJpy: 50_000,
      withheldResidentTaxJpy: 30_000,
      estimatedTaxPrepaymentJpy: 40_000,
    });

    expect(result.nationalTaxBalanceJpy.toNumber()).toBeCloseTo(
      result.totalNationalTaxJpy.toNumber() - 50_000 - 40_000,
      6,
    );
    expect(result.residentTaxBalanceJpy.toNumber()).toBeCloseTo(
      result.totalResidentTaxJpy.toNumber() - 30_000,
      6,
    );
    expect(result.totalTaxBalanceJpy.toNumber()).toBeCloseTo(
      result.nationalTaxBalanceJpy.toNumber() + result.residentTaxBalanceJpy.toNumber(),
      6,
    );
    expect(result.estimatedTaxPrepaymentJpy.toNumber()).toBe(40_000);
  });

  it("予定納税額のみ入力した場合も所得税等の見込み額に反映される", () => {
    const without = estimateTotalTax({
      otherComprehensiveIncomeJpy: 3_000_000,
      cryptoMiscIncomeJpy: 0,
      investmentTaxableGainJpy: 0,
      futuresTaxableGainJpy: 0,
      dividendIncomeJpy: 0,
    });
    const withPrepayment = estimateTotalTax({
      otherComprehensiveIncomeJpy: 3_000_000,
      cryptoMiscIncomeJpy: 0,
      investmentTaxableGainJpy: 0,
      futuresTaxableGainJpy: 0,
      dividendIncomeJpy: 0,
      estimatedTaxPrepaymentJpy: 10_000,
    });

    expect(
      without.nationalTaxBalanceJpy.minus(withPrepayment.nationalTaxBalanceJpy).toNumber(),
    ).toBe(10_000);
    expect(without.residentTaxBalanceJpy.toNumber()).toBe(
      withPrepayment.residentTaxBalanceJpy.toNumber(),
    );
  });

  it("予定納税額が0円の場合はデフォルトの源泉徴収税額のみの挙動と一致する", () => {
    const result = estimateTotalTax({
      otherComprehensiveIncomeJpy: 3_000_000,
      cryptoMiscIncomeJpy: 0,
      investmentTaxableGainJpy: 0,
      futuresTaxableGainJpy: 0,
      dividendIncomeJpy: 0,
    });

    expect(result.estimatedTaxPrepaymentJpy.toNumber()).toBe(0);
  });

  it("負の予定納税額はエラーになる", () => {
    expect(() =>
      estimateTotalTax({
        otherComprehensiveIncomeJpy: 0,
        cryptoMiscIncomeJpy: 0,
        investmentTaxableGainJpy: 0,
        futuresTaxableGainJpy: 0,
        dividendIncomeJpy: 0,
        estimatedTaxPrepaymentJpy: -1,
      }),
    ).toThrow();
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
