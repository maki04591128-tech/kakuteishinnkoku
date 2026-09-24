import { describe, expect, it } from "vitest";
import { estimateLifeInsurancePremiumDeduction } from "./lifeInsuranceDeduction";

function emptyInput() {
  return {
    general: { newPremiumJpy: 0, oldPremiumJpy: 0 },
    medicalCare: { newPremiumJpy: 0 },
    individualPension: { newPremiumJpy: 0, oldPremiumJpy: 0 },
  };
}

describe("estimateLifeInsurancePremiumDeduction", () => {
  it("新制度のみ・各区分の速算表どおりに控除額を計算する(所得税)", () => {
    const result = estimateLifeInsurancePremiumDeduction({
      ...emptyInput(),
      general: { newPremiumJpy: 30_000, oldPremiumJpy: 0 },
    });

    // 30,000円 × 1/2 + 10,000円 = 25,000円
    expect(result.general.incomeTaxDeductionJpy.toNumber()).toBe(25_000);
  });

  it("新制度の年間払込保険料が8万円超の場合は上限4万円になる(所得税)", () => {
    const result = estimateLifeInsurancePremiumDeduction({
      ...emptyInput(),
      general: { newPremiumJpy: 200_000, oldPremiumJpy: 0 },
    });

    expect(result.general.incomeTaxDeductionJpy.toNumber()).toBe(40_000);
  });

  it("旧制度のみの場合は旧制度の速算表を使い上限5万円になる(所得税)", () => {
    const result = estimateLifeInsurancePremiumDeduction({
      ...emptyInput(),
      individualPension: { newPremiumJpy: 0, oldPremiumJpy: 200_000 },
    });

    expect(result.individualPension.incomeTaxDeductionJpy.toNumber()).toBe(50_000);
  });

  it("新旧両方の契約がある場合は最も有利な金額(旧制度単独)を選択する(所得税)", () => {
    // 旧制度80,000円単独: 80,000×1/4+25,000 = 45,000円
    // 新制度10,000円単独: 10,000円
    // 合算: min(40,000, 10,000+45,000) = 40,000円
    // → 旧制度単独の45,000円が最も有利
    const result = estimateLifeInsurancePremiumDeduction({
      ...emptyInput(),
      general: { newPremiumJpy: 10_000, oldPremiumJpy: 80_000 },
    });

    expect(result.general.incomeTaxDeductionJpy.toNumber()).toBe(45_000);
  });

  it("介護医療保険料は新制度の速算表のみで計算する", () => {
    const result = estimateLifeInsurancePremiumDeduction({
      ...emptyInput(),
      medicalCare: { newPremiumJpy: 100_000 },
    });

    expect(result.medicalCare.incomeTaxDeductionJpy.toNumber()).toBe(40_000);
    expect(result.medicalCare.residentTaxDeductionJpy.toNumber()).toBe(28_000);
  });

  it("3区分合計は所得税12万円が上限になる", () => {
    const result = estimateLifeInsurancePremiumDeduction({
      general: { newPremiumJpy: 200_000, oldPremiumJpy: 0 },
      medicalCare: { newPremiumJpy: 200_000 },
      individualPension: { newPremiumJpy: 200_000, oldPremiumJpy: 0 },
    });

    expect(result.totalIncomeTaxDeductionJpy.toNumber()).toBe(120_000);
  });

  it("3区分合計は住民税7万円が上限になる(区分ごとの上限合計28,000×3=84,000円を超えるケース)", () => {
    const result = estimateLifeInsurancePremiumDeduction({
      general: { newPremiumJpy: 200_000, oldPremiumJpy: 0 },
      medicalCare: { newPremiumJpy: 200_000 },
      individualPension: { newPremiumJpy: 200_000, oldPremiumJpy: 0 },
    });

    expect(result.totalResidentTaxDeductionJpy.toNumber()).toBe(70_000);
  });

  it("入力が全て0円なら控除額も0円になる", () => {
    const result = estimateLifeInsurancePremiumDeduction(emptyInput());

    expect(result.totalIncomeTaxDeductionJpy.toNumber()).toBe(0);
    expect(result.totalResidentTaxDeductionJpy.toNumber()).toBe(0);
  });

  it("令和8年分で23歳未満の扶養親族ありの場合、一般生命保険料(新制度)の上限が6万円に引き上がる", () => {
    const result = estimateLifeInsurancePremiumDeduction({
      ...emptyInput(),
      general: { newPremiumJpy: 200_000, oldPremiumJpy: 0 },
      year: 2026,
      hasDependentUnder23: true,
    });

    expect(result.general.incomeTaxDeductionJpy.toNumber()).toBe(60_000);
    // 住民税はこの特例の対象外のため従来どおり上限2.8万円のまま
    expect(result.general.residentTaxDeductionJpy.toNumber()).toBe(28_000);
    expect(result.notes.some((note) => note.includes("時限特例"))).toBe(true);
  });

  it("令和9年分で23歳未満の扶養親族ありの場合も特例の速算表どおりに計算する", () => {
    const result = estimateLifeInsurancePremiumDeduction({
      ...emptyInput(),
      general: { newPremiumJpy: 45_000, oldPremiumJpy: 0 },
      year: 2027,
      hasDependentUnder23: true,
    });

    // 45,000円 × 1/2 + 15,000円 = 37,500円
    expect(result.general.incomeTaxDeductionJpy.toNumber()).toBe(37_500);
  });

  it("令和8年分でも23歳未満の扶養親族のチェックが無ければ従来どおり上限4万円のまま", () => {
    const result = estimateLifeInsurancePremiumDeduction({
      ...emptyInput(),
      general: { newPremiumJpy: 200_000, oldPremiumJpy: 0 },
      year: 2026,
      hasDependentUnder23: false,
    });

    expect(result.general.incomeTaxDeductionJpy.toNumber()).toBe(40_000);
  });

  it("令和10年分は特例の対象年分外のため扶養親族ありでも従来どおり上限4万円のまま", () => {
    const result = estimateLifeInsurancePremiumDeduction({
      ...emptyInput(),
      general: { newPremiumJpy: 200_000, oldPremiumJpy: 0 },
      year: 2028,
      hasDependentUnder23: true,
    });

    expect(result.general.incomeTaxDeductionJpy.toNumber()).toBe(40_000);
  });

  it("負の入力値はエラーになる", () => {
    expect(() =>
      estimateLifeInsurancePremiumDeduction({
        ...emptyInput(),
        general: { newPremiumJpy: -1, oldPremiumJpy: 0 },
      }),
    ).toThrow();
    expect(() =>
      estimateLifeInsurancePremiumDeduction({
        ...emptyInput(),
        medicalCare: { newPremiumJpy: -1 },
      }),
    ).toThrow();
  });
});
