import { describe, expect, it } from "vitest";
import { compareDonationTaxTreatment, estimateDonationTaxCredit } from "./donationTaxCredit";

describe("estimateDonationTaxCredit", () => {
  it("政党等寄附金特別控除額を(寄附金-2,000円)×30%(100円未満切り捨て)で計算する", () => {
    const result = estimateDonationTaxCredit({
      politicalPartyDonationJpy: 100_000,
      certifiedNpoDonationJpy: 0,
      publicInterestCorporationDonationJpy: 0,
      totalIncomeJpy: 5_000_000,
      incomeTaxBeforeCreditJpy: 500_000,
    });

    // (100,000 - 2,000) * 30% = 29,400
    expect(result.politicalPartyCreditJpy.toNumber()).toBe(29_400);
    expect(result.npoAndPublicInterestCreditJpy.toNumber()).toBe(0);
    expect(result.totalTaxCreditJpy.toNumber()).toBe(29_400);
  });

  it("認定NPO法人等・公益社団法人等の控除額を40%で計算し合算する", () => {
    const result = estimateDonationTaxCredit({
      politicalPartyDonationJpy: 0,
      certifiedNpoDonationJpy: 50_000,
      publicInterestCorporationDonationJpy: 30_000,
      totalIncomeJpy: 5_000_000,
      incomeTaxBeforeCreditJpy: 500_000,
    });

    // (50,000 - 2,000) * 40% = 19,200 / (30,000 - 2,000) * 40% = 11,200
    expect(result.certifiedNpoCreditRawJpy.toNumber()).toBe(19_200);
    expect(result.publicInterestCorporationCreditRawJpy.toNumber()).toBe(11_200);
    expect(result.npoAndPublicInterestCreditJpy.toNumber()).toBe(30_400);
    expect(result.totalTaxCreditJpy.toNumber()).toBe(30_400);
  });

  it("寄附金の額は総所得金額等の40%が上限になる", () => {
    const result = estimateDonationTaxCredit({
      politicalPartyDonationJpy: 1_000_000,
      certifiedNpoDonationJpy: 0,
      publicInterestCorporationDonationJpy: 0,
      totalIncomeJpy: 100_000,
      incomeTaxBeforeCreditJpy: 500_000,
    });

    // 40%上限 = 40,000円。(40,000 - 2,000) * 30% = 11,400
    expect(result.politicalPartyCreditJpy.toNumber()).toBe(11_400);
  });

  it("政党等寄附金特別控除額は所得税額の25%相当額(100円未満切り捨て)が上限になる", () => {
    const result = estimateDonationTaxCredit({
      politicalPartyDonationJpy: 1_000_000,
      certifiedNpoDonationJpy: 0,
      publicInterestCorporationDonationJpy: 0,
      totalIncomeJpy: 10_000_000,
      incomeTaxBeforeCreditJpy: 100_050,
    });

    // (1,000,000 - 2,000) * 30% = 299,400 > 上限(100,050 * 25% = 25,012.5 → 25,000円)
    expect(result.taxAmountCapJpy.toNumber()).toBe(25_000);
    expect(result.politicalPartyCreditJpy.toNumber()).toBe(25_000);
    expect(result.notes.join("")).toContain("政党等寄附金特別控除額が所得税額の25%相当額を超える");
  });

  it("認定NPO法人等・公益社団法人等は合算して所得税額の25%相当額が上限になる(政党等とは別枠)", () => {
    const result = estimateDonationTaxCredit({
      politicalPartyDonationJpy: 1_000_000,
      certifiedNpoDonationJpy: 500_000,
      publicInterestCorporationDonationJpy: 500_000,
      totalIncomeJpy: 10_000_000,
      incomeTaxBeforeCreditJpy: 100_000,
    });

    const cap = result.taxAmountCapJpy.toNumber(); // 100,000 * 25% = 25,000
    expect(cap).toBe(25_000);
    // 政党等は自身の25%枠で頭打ちになり、NPO等+公益法人等は別枠でさらに25%まで頭打ちになる
    expect(result.politicalPartyCreditJpy.toNumber()).toBe(cap);
    expect(result.npoAndPublicInterestCreditJpy.toNumber()).toBe(cap);
    expect(result.totalTaxCreditJpy.toNumber()).toBe(cap * 2);
  });

  it("負の入力値はエラーになる", () => {
    expect(() =>
      estimateDonationTaxCredit({
        politicalPartyDonationJpy: -1,
        certifiedNpoDonationJpy: 0,
        publicInterestCorporationDonationJpy: 0,
        totalIncomeJpy: 5_000_000,
        incomeTaxBeforeCreditJpy: 500_000,
      }),
    ).toThrow();
  });
});

describe("compareDonationTaxTreatment", () => {
  it("特別控除(税額控除)の方が有利な場合はTAX_CREDITを推奨する", () => {
    const result = compareDonationTaxTreatment(
      "CERTIFIED_NPO",
      100_000,
      5_000_000,
      500_000,
      0.2,
    );

    // 税額控除: (100,000-2,000)*40%=39,200 / 所得控除: (100,000-2,000)*20%*1.021≒20,011.6
    expect(result.taxCreditJpy.toNumber()).toBe(39_200);
    expect(result.incomeDeductionIncomeTaxSavingsJpy.toNumber()).toBeCloseTo(20_011.6, 5);
    expect(result.recommended).toBe("TAX_CREDIT");
  });

  it("限界税率が高い場合は寄附金控除(所得控除)の方が有利になりうる", () => {
    const result = compareDonationTaxTreatment(
      "CERTIFIED_NPO",
      100_000,
      5_000_000,
      500_000,
      0.45,
    );

    // 税額控除: 39,200 / 所得控除: (100,000-2,000)*45%*1.021≒45,006.66
    expect(result.taxCreditJpy.toNumber()).toBe(39_200);
    expect(result.incomeDeductionIncomeTaxSavingsJpy.greaterThan(result.taxCreditJpy)).toBe(true);
    expect(result.recommended).toBe("INCOME_DEDUCTION");
  });

  it("同額の場合はEITHERを返す", () => {
    const result = compareDonationTaxTreatment("POLITICAL_PARTY", 0, 5_000_000, 500_000, 0.1);

    expect(result.taxCreditJpy.toNumber()).toBe(0);
    expect(result.incomeDeductionIncomeTaxSavingsJpy.toNumber()).toBe(0);
    expect(result.recommended).toBe("EITHER");
  });
});
