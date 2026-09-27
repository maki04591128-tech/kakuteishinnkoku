import { describe, expect, it } from "vitest";
import { estimateEarthquakeRenovationDeduction } from "./earthquakeRenovationDeduction";

describe("estimateEarthquakeRenovationDeduction", () => {
  it("標準的な工事費用相当額が控除対象限度額以下の場合はA(10%)のみが控除額になる(100円未満切り捨て)", () => {
    const result = estimateEarthquakeRenovationDeduction({ standardCostJpy: 1_234_567 });

    // 1,234,567 * 10% = 123,456.7 -> 100円未満切り捨てで123,400円
    expect(result.creditJpy.toNumber()).toBe(123_400);
    expect(result.cappedStandardCostJpy.toNumber()).toBe(1_234_567);
    expect(result.amountAJpy.toNumber()).toBe(1_234_567);
    expect(result.amountBJpy.toNumber()).toBe(0);
    expect(result.notes.some((n) => n.includes("250万円で頭打ち"))).toBe(false);
  });

  it("250万円を超える場合、超過分はB(5%控除)の対象になる(機能149で修正)", () => {
    const result = estimateEarthquakeRenovationDeduction({ standardCostJpy: 3_000_000 });

    expect(result.cappedStandardCostJpy.toNumber()).toBe(2_500_000);
    expect(result.amountAJpy.toNumber()).toBe(2_500_000);
    expect(result.excessOverControlLimitJpy.toNumber()).toBe(500_000);
    // B候補(1)=500,000(超過分)+0(関連工事)=500,000、候補(2)=3,000,000 → 500,000
    expect(result.amountBJpy.toNumber()).toBe(500_000);
    // A: 2,500,000*10%=250,000 / B: 500,000*5%=25,000
    expect(result.creditJpy.toNumber()).toBe(275_000);
    expect(result.notes.some((n) => n.includes("250万円で頭打ち"))).toBe(true);
  });

  it("併せて行う増改築等工事費用がある場合はBに合算する", () => {
    const result = estimateEarthquakeRenovationDeduction({
      standardCostJpy: 2_000_000,
      otherRelatedWorkCostJpy: 1_000_000,
    });

    expect(result.amountAJpy.toNumber()).toBe(2_000_000);
    expect(result.excessOverControlLimitJpy.toNumber()).toBe(0);
    // B候補(1)=0+1,000,000=1,000,000、候補(2)=2,000,000 → 1,000,000
    expect(result.amountBJpy.toNumber()).toBe(1_000_000);
    expect(result.creditJpy.toNumber()).toBe(250_000);
  });

  it("Bが1,000万円からAを控除した限度額を超える場合は頭打ちにする", () => {
    const result = estimateEarthquakeRenovationDeduction({
      standardCostJpy: 9_000_000,
      otherRelatedWorkCostJpy: 3_000_000,
    });

    expect(result.amountAJpy.toNumber()).toBe(2_500_000);
    // 候補(1)=6,500,000+3,000,000=9,500,000、候補(2)=9,000,000 → 9,000,000だが
    // 1,000万円-250万円=750万円の限度で頭打ち
    expect(result.amountBJpy.toNumber()).toBe(7_500_000);
    expect(result.notes.some((n) => n.includes("頭打ちにした"))).toBe(true);
  });

  it("ちょうど250万円の場合も25万円になる(頭打ちの注記は出さない)", () => {
    const result = estimateEarthquakeRenovationDeduction({ standardCostJpy: 2_500_000 });

    expect(result.creditJpy.toNumber()).toBe(250_000);
    expect(result.notes.some((n) => n.includes("250万円で頭打ち"))).toBe(false);
  });

  it("0円の場合は控除額も0円になる", () => {
    const result = estimateEarthquakeRenovationDeduction({ standardCostJpy: 0 });

    expect(result.creditJpy.toNumber()).toBe(0);
  });

  it("合計所得金額がBの上限(2,000万円)を超える場合はBが適用されずAのみになる", () => {
    const result = estimateEarthquakeRenovationDeduction({
      standardCostJpy: 3_000_000,
      totalIncomeJpy: 20_000_001,
    });

    expect(result.bEligible).toBe(false);
    expect(result.amountBJpy.toNumber()).toBe(0);
    expect(result.creditJpy.toNumber()).toBe(250_000);
  });

  it("令和4年〜5年居住の経過措置により合計所得金額3,000万円以下ならBが適用される", () => {
    const result = estimateEarthquakeRenovationDeduction({
      standardCostJpy: 3_000_000,
      totalIncomeJpy: 25_000_000,
      residenceIn2022Or2023: true,
    });

    expect(result.bEligible).toBe(true);
    expect(result.amountBJpy.toNumber()).toBe(500_000);
    expect(result.creditJpy.toNumber()).toBe(275_000);
  });

  it("自己が所有する家屋でない場合はBが適用されない", () => {
    const result = estimateEarthquakeRenovationDeduction({
      standardCostJpy: 3_000_000,
      ownsHouse: false,
    });

    expect(result.bEligible).toBe(false);
    expect(result.creditJpy.toNumber()).toBe(250_000);
  });

  it("令和3年12月31日以前に耐震改修をした場合はBが適用されない", () => {
    const result = estimateEarthquakeRenovationDeduction({
      standardCostJpy: 3_000_000,
      beforeReiwa4: true,
    });

    expect(result.bEligible).toBe(false);
    expect(result.creditJpy.toNumber()).toBe(250_000);
  });

  it("併せて行う増改築等について住宅借入金等特別控除も適用を受ける場合はBが適用されない", () => {
    const result = estimateEarthquakeRenovationDeduction({
      standardCostJpy: 3_000_000,
      claimsMortgageDeductionForRelatedWork: true,
    });

    expect(result.bEligible).toBe(false);
    expect(result.creditJpy.toNumber()).toBe(250_000);
  });

  it("負の値を入力するとエラーになる", () => {
    expect(() => estimateEarthquakeRenovationDeduction({ standardCostJpy: -1 })).toThrow();
    expect(() =>
      estimateEarthquakeRenovationDeduction({
        standardCostJpy: 0,
        otherRelatedWorkCostJpy: -1,
      }),
    ).toThrow();
  });
});
