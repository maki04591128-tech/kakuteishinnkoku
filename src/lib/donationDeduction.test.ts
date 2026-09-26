import { describe, expect, it } from "vitest";
import { estimateDonationDeduction } from "./donationDeduction";

describe("estimateDonationDeduction", () => {
  it("所得税控除・住民税基本控除・住民税特例控除を速算式通りに計算する(上限に達しない場合)", () => {
    const result = estimateDonationDeduction({
      totalDonationJpy: 50_000,
      furusatoNozeiDonationJpy: 50_000,
      totalIncomeJpy: 5_000_000,
      residentTaxIncomeLeviedJpy: 300_000,
      marginalIncomeTaxRate: 0.2,
    });

    expect(result.incomeTaxDeductionJpy.toNumber()).toBe(48_000);
    expect(result.residentTaxBasicDeductionJpy.toNumber()).toBeCloseTo(4_800, 6);

    const expectedSpecial = (50_000 - 2_000) * (0.9 - 0.2 * 1.021);
    expect(result.residentTaxSpecialDeductionJpy.toNumber()).toBeCloseTo(expectedSpecial, 6);
    expect(result.residentTaxSpecialDeductionLimitJpy.toNumber()).toBe(60_000);
    expect(result.residentTaxTotalDeductionJpy.toNumber()).toBeCloseTo(
      4_800 + expectedSpecial,
      6,
    );
  });

  it("総所得金額等の40%/30%を超える寄附金は控除額算定の基礎からあふれる", () => {
    const result = estimateDonationDeduction({
      totalDonationJpy: 200_000,
      furusatoNozeiDonationJpy: 0,
      totalIncomeJpy: 300_000,
      residentTaxIncomeLeviedJpy: 300_000,
      marginalIncomeTaxRate: 0.2,
    });

    // 所得税: min(200,000, 300,000*40%=120,000) - 2,000 = 118,000
    expect(result.incomeTaxDeductionJpy.toNumber()).toBe(118_000);
    // 住民税基本控除: (min(200,000, 300,000*30%=90,000) - 2,000) * 10% = 8,800
    expect(result.residentTaxBasicDeductionJpy.toNumber()).toBeCloseTo(8_800, 6);
    // ふるさと納税額が0円のため特例控除は発生しない
    expect(result.residentTaxSpecialDeductionJpy.toNumber()).toBe(0);
  });

  it("特例控除額は住民税所得割額の20%で頭打ちになる", () => {
    const result = estimateDonationDeduction({
      totalDonationJpy: 100_000,
      furusatoNozeiDonationJpy: 100_000,
      totalIncomeJpy: 5_000_000,
      residentTaxIncomeLeviedJpy: 300_000,
      marginalIncomeTaxRate: 0.2,
    });

    // 頭打ちにならない場合の理論値: 98,000 * (0.9 - 0.2*1.021) ≈ 68,188 > 60,000
    expect(result.residentTaxSpecialDeductionLimitJpy.toNumber()).toBe(60_000);
    expect(result.residentTaxSpecialDeductionJpy.toNumber()).toBe(60_000);
    expect(result.notes.join("")).toContain("上限額");
  });

  it("ふるさと納税額が寄附金の合計額を超える入力はエラーになる", () => {
    expect(() =>
      estimateDonationDeduction({
        totalDonationJpy: 10_000,
        furusatoNozeiDonationJpy: 20_000,
        totalIncomeJpy: 5_000_000,
        residentTaxIncomeLeviedJpy: 300_000,
        marginalIncomeTaxRate: 0.2,
      }),
    ).toThrow();
  });

  it("負の入力値はエラーになる", () => {
    expect(() =>
      estimateDonationDeduction({
        totalDonationJpy: -1,
        furusatoNozeiDonationJpy: 0,
        totalIncomeJpy: 5_000_000,
        residentTaxIncomeLeviedJpy: 300_000,
        marginalIncomeTaxRate: 0.2,
      }),
    ).toThrow();
  });

  it("所得税の限界税率が45%を超える入力はエラーになる", () => {
    expect(() =>
      estimateDonationDeduction({
        totalDonationJpy: 10_000,
        furusatoNozeiDonationJpy: 10_000,
        totalIncomeJpy: 5_000_000,
        residentTaxIncomeLeviedJpy: 300_000,
        marginalIncomeTaxRate: 0.5,
      }),
    ).toThrow();
  });

  it("エンジェル税制(特定新規株式)の出資額は所得税の寄附金控除額にのみ加算し、住民税には加算しない(措置法37条の13の3)", () => {
    const result = estimateDonationDeduction({
      totalDonationJpy: 50_000,
      furusatoNozeiDonationJpy: 50_000,
      totalIncomeJpy: 10_000_000,
      residentTaxIncomeLeviedJpy: 300_000,
      marginalIncomeTaxRate: 0.2,
      angelTaxInvestmentJpy: 1_000_000,
    });

    expect(result.angelTaxDeemedDonationJpy.toNumber()).toBe(1_000_000);
    // 所得税: min(50,000+1,000,000, 10,000,000*40%) - 2,000 = 1,048,000
    expect(result.incomeTaxDeductionJpy.toNumber()).toBe(1_048_000);
    // 住民税基本控除は寄附金の合計額(50,000円)のみを基礎とし、エンジェル税制分は加算しない
    expect(result.residentTaxBasicDeductionJpy.toNumber()).toBeCloseTo(4_800, 6);
    expect(result.notes.join("")).toContain("エンジェル税制");
  });

  it("エンジェル税制の出資額は800万円を超える部分を切り捨てて寄附金控除額に加算する", () => {
    const result = estimateDonationDeduction({
      totalDonationJpy: 0,
      furusatoNozeiDonationJpy: 0,
      totalIncomeJpy: 100_000_000,
      residentTaxIncomeLeviedJpy: 300_000,
      marginalIncomeTaxRate: 0.2,
      angelTaxInvestmentJpy: 12_000_000,
    });

    expect(result.angelTaxDeemedDonationJpy.toNumber()).toBe(8_000_000);
    expect(result.incomeTaxDeductionJpy.toNumber()).toBe(8_000_000 - 2_000);
    expect(result.notes.join("")).toContain("上限800万円");
  });

  it("エンジェル税制の出資額を指定しない場合は従来どおり寄附金控除額に影響しない", () => {
    const result = estimateDonationDeduction({
      totalDonationJpy: 50_000,
      furusatoNozeiDonationJpy: 50_000,
      totalIncomeJpy: 5_000_000,
      residentTaxIncomeLeviedJpy: 300_000,
      marginalIncomeTaxRate: 0.2,
    });

    expect(result.angelTaxDeemedDonationJpy.toNumber()).toBe(0);
    expect(result.incomeTaxDeductionJpy.toNumber()).toBe(48_000);
  });

  it("エンジェル税制の出資額が負の値だとエラーになる", () => {
    expect(() =>
      estimateDonationDeduction({
        totalDonationJpy: 0,
        furusatoNozeiDonationJpy: 0,
        totalIncomeJpy: 5_000_000,
        residentTaxIncomeLeviedJpy: 300_000,
        marginalIncomeTaxRate: 0.2,
        angelTaxInvestmentJpy: -1,
      }),
    ).toThrow();
  });
});
