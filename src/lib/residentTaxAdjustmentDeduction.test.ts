import { describe, expect, it } from "vitest";
import {
  calculatePersonalDeductionDifference,
  estimateResidentTaxAdjustmentDeduction,
} from "./residentTaxAdjustmentDeduction";

describe("calculatePersonalDeductionDifference", () => {
  it("基礎控除以外に該当する人的控除が無い場合、基礎控除の差額のみになる", () => {
    const result = calculatePersonalDeductionDifference({
      year: 2024,
      taxpayerTotalIncomeJpy: 3_000_000,
    });

    expect(result.totalJpy.toNumber()).toBe(50_000);
    expect(result.breakdown).toHaveLength(1);
  });

  it("基礎控除のみの場合、令和6年分以前は合計所得金額2,400万円以下で一律5万円になる", () => {
    const result = calculatePersonalDeductionDifference({
      year: 2024,
      taxpayerTotalIncomeJpy: 5_000_000,
    });

    expect(result.totalJpy.toNumber()).toBe(50_000);
  });

  it("基礎控除のみの場合、令和7年分以後は合計所得金額132万円以下・336万円以下は経過措置で5万円に据え置かれる", () => {
    const low = calculatePersonalDeductionDifference({
      year: 2025,
      taxpayerTotalIncomeJpy: 1_000_000,
    });
    const mid = calculatePersonalDeductionDifference({
      year: 2025,
      taxpayerTotalIncomeJpy: 3_000_000,
    });

    expect(low.totalJpy.toNumber()).toBe(50_000);
    expect(mid.totalJpy.toNumber()).toBe(50_000);
  });

  it("基礎控除のみの場合、令和7年分以後は合計所得金額336万円超655万円以下で所得税・住民税の実差額になる", () => {
    const band489 = calculatePersonalDeductionDifference({
      year: 2025,
      taxpayerTotalIncomeJpy: 4_000_000,
    });
    const band655 = calculatePersonalDeductionDifference({
      year: 2025,
      taxpayerTotalIncomeJpy: 6_000_000,
    });

    expect(band489.totalJpy.toNumber()).toBe(250_000);
    expect(band655.totalJpy.toNumber()).toBe(200_000);
  });

  it("配偶者控除(一般)は合計所得金額900万円以下で5万円になる(基礎控除5万円と合算)", () => {
    const result = calculatePersonalDeductionDifference({
      year: 2024,
      taxpayerTotalIncomeJpy: 5_000_000,
      spouse: { category: "GENERAL" },
    });

    expect(result.totalJpy.toNumber()).toBe(50_000 + 50_000);
  });

  it("配偶者控除(老人控除対象配偶者)は合計所得金額900万円以下で10万円になる(基礎控除5万円と合算)", () => {
    const result = calculatePersonalDeductionDifference({
      year: 2024,
      taxpayerTotalIncomeJpy: 5_000_000,
      spouse: { category: "ELDERLY" },
    });

    expect(result.totalJpy.toNumber()).toBe(50_000 + 100_000);
  });

  it("納税者本人の合計所得金額が1,000万円超の場合、配偶者控除の人的控除額の差は算入しない(基礎控除は2,400万円以下のため算入)", () => {
    const result = calculatePersonalDeductionDifference({
      year: 2024,
      taxpayerTotalIncomeJpy: 11_000_000,
      spouse: { category: "GENERAL" },
    });

    expect(result.totalJpy.toNumber()).toBe(50_000);
  });

  it("扶養控除は区分ごとの人数分を合算する(一般5万円・特定18万円・老人10万円・同居老親等13万円)", () => {
    const result = calculatePersonalDeductionDifference({
      year: 2024,
      taxpayerTotalIncomeJpy: 5_000_000,
      dependents: {
        GENERAL: 2,
        SPECIFIED: 1,
        ELDERLY_OTHER: 1,
        ELDERLY_COHABITING: 1,
      },
    });

    // 基礎控除5万円(令和6年分以前は一律5万円)も加算される
    expect(result.totalJpy.toNumber()).toBe(50_000 + 50_000 * 2 + 180_000 + 100_000 + 130_000);
  });

  it("障害者控除は本人・同一生計配偶者・扶養親族の区分ごとに1万円/10万円/22万円を合算する", () => {
    const result = calculatePersonalDeductionDifference({
      year: 2024,
      taxpayerTotalIncomeJpy: 5_000_000,
      disability: {
        taxpayerCategory: "GENERAL",
        specialCount: 1,
        specialLivingTogetherCount: 1,
      },
    });

    expect(result.totalJpy.toNumber()).toBe(50_000 + 10_000 + 100_000 + 220_000);
  });

  it("ひとり親控除は父1万円・母5万円と人的控除額の差が異なる", () => {
    const father = calculatePersonalDeductionDifference({
      year: 2024,
      taxpayerTotalIncomeJpy: 5_000_000,
      widowSingleParentCategory: "SINGLE_PARENT_FATHER",
    });
    const mother = calculatePersonalDeductionDifference({
      year: 2024,
      taxpayerTotalIncomeJpy: 5_000_000,
      widowSingleParentCategory: "SINGLE_PARENT_MOTHER",
    });

    expect(father.totalJpy.toNumber()).toBe(50_000 + 10_000);
    expect(mother.totalJpy.toNumber()).toBe(50_000 + 50_000);
  });

  it("寡婦控除・勤労学生控除はそれぞれ1万円になる", () => {
    const result = calculatePersonalDeductionDifference({
      year: 2024,
      taxpayerTotalIncomeJpy: 5_000_000,
      widowSingleParentCategory: "WIDOW",
      workingStudent: true,
    });

    expect(result.totalJpy.toNumber()).toBe(50_000 + 20_000);
  });
});

describe("estimateResidentTaxAdjustmentDeduction", () => {
  it("合計課税所得金額200万円以下の場合、人的控除額の差の合計額と合計課税所得金額のいずれか少ない額の5%になる", () => {
    const result = estimateResidentTaxAdjustmentDeduction({
      personalDeductionDifference: {
        year: 2024,
        taxpayerTotalIncomeJpy: 1_800_000,
      },
      totalTaxableIncomeJpy: 1_800_000,
    });

    expect(result.personalDeductionDifferenceTotalJpy.toNumber()).toBe(50_000);
    expect(result.adjustmentDeductionJpy.toNumber()).toBe(2_500);
  });

  it("合計課税所得金額が人的控除額の差の合計額より小さい場合、合計課税所得金額を基準にする", () => {
    const result = estimateResidentTaxAdjustmentDeduction({
      personalDeductionDifference: {
        year: 2024,
        taxpayerTotalIncomeJpy: 5_000_000,
        dependents: { SPECIFIED: 1 },
      },
      totalTaxableIncomeJpy: 100_000,
    });

    expect(result.personalDeductionDifferenceTotalJpy.toNumber()).toBe(50_000 + 180_000);
    expect(result.adjustmentDeductionJpy.toNumber()).toBe(5_000);
  });

  it("合計課税所得金額200万円超の場合、(差額-超過額)の5%になる", () => {
    const result = estimateResidentTaxAdjustmentDeduction({
      personalDeductionDifference: {
        year: 2024,
        taxpayerTotalIncomeJpy: 5_000_000,
        dependents: { SPECIFIED: 1 },
      },
      totalTaxableIncomeJpy: 2_100_000,
    });

    expect(result.personalDeductionDifferenceTotalJpy.toNumber()).toBe(230_000);
    expect(result.adjustmentDeductionJpy.toNumber()).toBe((230_000 - 100_000) * 0.05);
  });

  it("(差額-超過額)が5万円未満になる場合は5万円を基準にする(下限2,500円)", () => {
    const result = estimateResidentTaxAdjustmentDeduction({
      personalDeductionDifference: {
        year: 2024,
        taxpayerTotalIncomeJpy: 5_000_000,
      },
      totalTaxableIncomeJpy: 3_000_000,
    });

    expect(result.adjustmentDeductionJpy.toNumber()).toBe(2_500);
  });

  it("合計所得金額が2,500万円を超える場合、調整控除は適用されない", () => {
    const result = estimateResidentTaxAdjustmentDeduction({
      personalDeductionDifference: {
        year: 2024,
        taxpayerTotalIncomeJpy: 26_000_000,
      },
      totalTaxableIncomeJpy: 3_000_000,
    });

    expect(result.adjustmentDeductionJpy.toNumber()).toBe(0);
    expect(result.notes.some((n) => n.includes("2,500万円"))).toBe(true);
  });

  it("令和8年分以後は基礎控除の人的控除額の差の扱いが未検証である旨の注記が付く(令和8年度税制改正によるさらなる引上げのため)", () => {
    for (const year of [2026, 2027]) {
      const result = estimateResidentTaxAdjustmentDeduction({
        personalDeductionDifference: {
          year,
          taxpayerTotalIncomeJpy: 5_000_000,
        },
        totalTaxableIncomeJpy: 1_000_000,
      });

      expect(result.notes.some((n) => n.includes("令和8年分") && n.includes("一次情報"))).toBe(true);
    }
  });

  it("令和7年分は未検証の注記が付かない", () => {
    const result = estimateResidentTaxAdjustmentDeduction({
      personalDeductionDifference: {
        year: 2025,
        taxpayerTotalIncomeJpy: 5_000_000,
      },
      totalTaxableIncomeJpy: 1_000_000,
    });

    expect(result.notes.some((n) => n.includes("一次情報で確認できていない"))).toBe(false);
  });
});
