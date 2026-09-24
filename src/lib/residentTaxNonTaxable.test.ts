import { describe, expect, it } from "vitest";
import { estimateResidentTaxNonTaxable } from "./residentTaxNonTaxable";

describe("estimateResidentTaxNonTaxable", () => {
  it("扶養親族がおらず合計所得金額が45万円以下(1級地)なら所得割・均等割ともに非課税", () => {
    const result = estimateResidentTaxNonTaxable({
      totalIncomeJpy: 450_000,
      dependentCount: 0,
    });

    expect(result.perCapitaLevyThresholdJpy.toNumber()).toBe(450_000);
    expect(result.incomeLevyThresholdJpy.toNumber()).toBe(450_000);
    expect(result.perCapitaLevyNonTaxable).toBe(true);
    expect(result.incomeLevyNonTaxable).toBe(true);
  });

  it("扶養親族がおらず合計所得金額が45万円を超える(1級地)なら所得割・均等割ともに課税", () => {
    const result = estimateResidentTaxNonTaxable({
      totalIncomeJpy: 450_001,
      dependentCount: 0,
    });

    expect(result.perCapitaLevyNonTaxable).toBe(false);
    expect(result.incomeLevyNonTaxable).toBe(false);
  });

  it("扶養親族が2人(1級地)の場合、均等割は35万円×3+21万円+10万円=136万円が非課税限度額になる", () => {
    const result = estimateResidentTaxNonTaxable({
      totalIncomeJpy: 1_360_000,
      dependentCount: 2,
    });

    expect(result.perCapitaLevyThresholdJpy.toNumber()).toBe(1_360_000);
    expect(result.perCapitaLevyNonTaxable).toBe(true);
  });

  it("扶養親族が2人(1級地)の場合、所得割は35万円×3+32万円+10万円=147万円が非課税限度額になる", () => {
    const result = estimateResidentTaxNonTaxable({
      totalIncomeJpy: 1_470_000,
      dependentCount: 2,
    });

    expect(result.incomeLevyThresholdJpy.toNumber()).toBe(1_470_000);
    expect(result.incomeLevyNonTaxable).toBe(true);
  });

  it("所得割の非課税限度額は均等割より高いため、均等割は課税・所得割のみ非課税になる場合がある", () => {
    const result = estimateResidentTaxNonTaxable({
      totalIncomeJpy: 1_400_000,
      dependentCount: 2,
    });

    // 均等割限度額136万円 < 140万円 <= 所得割限度額147万円
    expect(result.perCapitaLevyNonTaxable).toBe(false);
    expect(result.incomeLevyNonTaxable).toBe(true);
  });

  it("2級地(31.5万円)では扶養親族がいない場合の非課税限度額が41.5万円になる", () => {
    const result = estimateResidentTaxNonTaxable({
      totalIncomeJpy: 415_000,
      dependentCount: 0,
      gradeClass: "GRADE_2",
    });

    expect(result.perCapitaLevyThresholdJpy.toNumber()).toBe(415_000);
    expect(result.perCapitaLevyNonTaxable).toBe(true);
  });

  it("3級地(28万円)では扶養親族がいない場合の非課税限度額が38万円になる", () => {
    const result = estimateResidentTaxNonTaxable({
      totalIncomeJpy: 380_000,
      dependentCount: 0,
      gradeClass: "GRADE_3",
    });

    expect(result.perCapitaLevyThresholdJpy.toNumber()).toBe(380_000);
    expect(result.perCapitaLevyNonTaxable).toBe(true);
  });

  it("障害者に該当し合計所得金額が135万円以下なら、通常の非課税限度額を超えていても非課税", () => {
    const result = estimateResidentTaxNonTaxable({
      totalIncomeJpy: 1_350_000,
      dependentCount: 0,
      disability: true,
    });

    expect(result.specialCategoryApplies).toBe(true);
    expect(result.perCapitaLevyNonTaxable).toBe(true);
    expect(result.incomeLevyNonTaxable).toBe(true);
  });

  it("未成年者に該当し合計所得金額が135万円を超える場合、135万円以下の非課税規定は適用されない", () => {
    const result = estimateResidentTaxNonTaxable({
      totalIncomeJpy: 1_350_001,
      dependentCount: 0,
      minor: true,
    });

    expect(result.specialCategoryApplies).toBe(false);
    expect(result.perCapitaLevyNonTaxable).toBe(false);
    expect(result.incomeLevyNonTaxable).toBe(false);
  });

  it("寡婦・ひとり親に該当し合計所得金額が135万円以下なら非課税", () => {
    const result = estimateResidentTaxNonTaxable({
      totalIncomeJpy: 1_000_000,
      dependentCount: 0,
      widowOrSingleParent: true,
    });

    expect(result.specialCategoryApplies).toBe(true);
    expect(result.perCapitaLevyNonTaxable).toBe(true);
    expect(result.incomeLevyNonTaxable).toBe(true);
  });

  it("負の合計所得金額を入力するとエラーになる", () => {
    expect(() =>
      estimateResidentTaxNonTaxable({ totalIncomeJpy: -1, dependentCount: 0 }),
    ).toThrow();
  });

  it("扶養親族の人数が負・非整数だとエラーになる", () => {
    expect(() =>
      estimateResidentTaxNonTaxable({ totalIncomeJpy: 0, dependentCount: -1 }),
    ).toThrow();
    expect(() =>
      estimateResidentTaxNonTaxable({ totalIncomeJpy: 0, dependentCount: 1.5 }),
    ).toThrow();
  });
});
