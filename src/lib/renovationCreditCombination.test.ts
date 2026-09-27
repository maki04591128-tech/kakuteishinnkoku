import { describe, expect, it } from "vitest";
import {
  combineRenovationCredits,
  type RenovationCreditCombinationInput,
} from "./renovationCreditCombination";

describe("combineRenovationCredits", () => {
  it("1つの改修工事のみの場合は単体モジュールと同じ結果になる(バリアフリー、Bが超過分+関連工事)", () => {
    // barrierFreeRenovationDeduction.test.tsと同じ数値: standardCost=3,500,000
    // (控除対象限度額200万円超)、otherRelatedWorkCost=1,000,000のケースを想定。
    // A=2,000,000、超過分=1,500,000、B候補(1)=1,500,000+1,000,000=2,500,000、
    // B候補(2)=3,500,000 → B=2,500,000(1,000万円-200万円=800万円の限度内)。
    const result = combineRenovationCredits({
      categories: [
        {
          category: "BARRIER_FREE",
          standardCostJpy: 3_500_000,
          amountAJpy: 2_000_000,
          otherRelatedWorkCostJpy: 1_000_000,
        },
      ],
    });

    expect(result.totalAJpy.toNumber()).toBe(2_000_000);
    expect(result.totalACreditJpy.toNumber()).toBe(200_000);
    expect(result.combinedBLimitJpy.toNumber()).toBe(8_000_000);
    expect(result.combinedBJpy.toNumber()).toBe(2_500_000);
    expect(result.bCreditJpy.toNumber()).toBe(125_000);
    expect(result.totalCreditJpy.toNumber()).toBe(325_000);
  });

  it("バリアフリー改修と省エネ改修を併用する場合、Bの1,000万円の限度額を合算して判定する", () => {
    // バリアフリー: standardCost=2,000,000(控除対象限度額ちょうど) → A=2,000,000, 超過分=0
    // 省エネ: standardCost=4,500,000(控除対象限度額250万円超) → A=2,500,000, 超過分=2,000,000
    // 併用後のAの合計=4,500,000、Bの限度額=10,000,000-4,500,000=5,500,000
    // B候補(1)=(0+2,000,000)+関連工事0=2,000,000、B候補(2)=2,000,000+4,500,000=6,500,000
    // → B=2,000,000(5,500,000の限度内)
    const result = combineRenovationCredits({
      categories: [
        { category: "BARRIER_FREE", standardCostJpy: 2_000_000, amountAJpy: 2_000_000 },
        { category: "ENERGY_SAVING", standardCostJpy: 4_500_000, amountAJpy: 2_500_000 },
      ],
    });

    expect(result.totalAJpy.toNumber()).toBe(4_500_000);
    expect(result.totalACreditJpy.toNumber()).toBe(450_000);
    expect(result.combinedBLimitJpy.toNumber()).toBe(5_500_000);
    expect(result.candidate1Jpy.toNumber()).toBe(2_000_000);
    expect(result.candidate2Jpy.toNumber()).toBe(6_500_000);
    expect(result.combinedBJpy.toNumber()).toBe(2_000_000);
    expect(result.bCreditJpy.toNumber()).toBe(100_000);
    expect(result.totalCreditJpy.toNumber()).toBe(550_000);
  });

  it("併用後のBが「1,000万円-Aの合計」の限度額を超える場合は頭打ちにする", () => {
    // バリアフリー: standardCost=9,000,000 → A=2,000,000, 超過分=7,000,000
    // 省エネ: standardCost=9,000,000(太陽光無し) → A=2,500,000, 超過分=6,500,000
    // Aの合計=4,500,000、Bの限度額=10,000,000-4,500,000=5,500,000
    // B候補(1)=7,000,000+6,500,000=13,500,000、B候補(2)=9,000,000+9,000,000=18,000,000
    // → 5,500,000で頭打ち
    const result = combineRenovationCredits({
      categories: [
        { category: "BARRIER_FREE", standardCostJpy: 9_000_000, amountAJpy: 2_000_000 },
        { category: "ENERGY_SAVING", standardCostJpy: 9_000_000, amountAJpy: 2_500_000 },
      ],
    });

    expect(result.combinedBLimitJpy.toNumber()).toBe(5_500_000);
    expect(result.combinedBJpy.toNumber()).toBe(5_500_000);
    expect(result.bCreditJpy.toNumber()).toBe(275_000);
    expect(result.totalCreditJpy.toNumber()).toBe(725_000);
    expect(result.notes.some((n) => n.includes("頭打ちにした"))).toBe(true);
  });

  it("3類型(バリアフリー・多世帯同居・子育て対応)を併用する場合もAの合計を正しく合算する", () => {
    const result = combineRenovationCredits({
      categories: [
        { category: "BARRIER_FREE", standardCostJpy: 1_500_000, amountAJpy: 1_500_000 },
        { category: "MULTI_HOUSEHOLD", standardCostJpy: 2_000_000, amountAJpy: 2_000_000 },
        { category: "CHILD_REARING", standardCostJpy: 1_000_000, amountAJpy: 1_000_000 },
      ],
    });

    expect(result.totalAJpy.toNumber()).toBe(4_500_000);
    expect(result.totalACreditJpy.toNumber()).toBe(450_000);
    // 超過分・関連工事費用がいずれも無いためBは0
    expect(result.combinedBJpy.toNumber()).toBe(0);
    expect(result.totalCreditJpy.toNumber()).toBe(450_000);
  });

  it("住宅耐震改修とバリアフリー改修を併用する場合もBの1,000万円の限度額を合算する", () => {
    // 住宅耐震改修: standardCost=3,000,000(控除対象限度額250万円超) → A=2,500,000, 超過分=500,000
    // バリアフリー: standardCost=3,000,000(控除対象限度額200万円超) → A=2,000,000, 超過分=1,000,000
    // Aの合計=4,500,000、Bの限度額=10,000,000-4,500,000=5,500,000
    // B候補(1)=500,000+1,000,000=1,500,000、B候補(2)=3,000,000+3,000,000=6,000,000
    // → B=1,500,000(5,500,000の限度内)
    const result = combineRenovationCredits({
      categories: [
        { category: "EARTHQUAKE", standardCostJpy: 3_000_000, amountAJpy: 2_500_000 },
        { category: "BARRIER_FREE", standardCostJpy: 3_000_000, amountAJpy: 2_000_000 },
      ],
    });

    expect(result.totalAJpy.toNumber()).toBe(4_500_000);
    expect(result.combinedBLimitJpy.toNumber()).toBe(5_500_000);
    expect(result.combinedBJpy.toNumber()).toBe(1_500_000);
    expect(result.bCreditJpy.toNumber()).toBe(75_000);
    expect(result.totalCreditJpy.toNumber()).toBe(525_000);
  });

  it("同じ改修工事の種類を重複して入力するとエラーになる", () => {
    const input: RenovationCreditCombinationInput = {
      categories: [
        { category: "BARRIER_FREE", standardCostJpy: 1_000_000, amountAJpy: 1_000_000 },
        { category: "BARRIER_FREE", standardCostJpy: 1_000_000, amountAJpy: 1_000_000 },
      ],
    };
    expect(() => combineRenovationCredits(input)).toThrow();
  });

  it("Aが標準的な費用の額を超える入力はエラーになる", () => {
    expect(() =>
      combineRenovationCredits({
        categories: [
          { category: "BARRIER_FREE", standardCostJpy: 1_000_000, amountAJpy: 2_000_000 },
        ],
      }),
    ).toThrow();
  });

  it("入力が空の場合はエラーになる", () => {
    expect(() => combineRenovationCredits({ categories: [] })).toThrow();
  });

  it("負の値を入力するとエラーになる", () => {
    expect(() =>
      combineRenovationCredits({
        categories: [
          { category: "BARRIER_FREE", standardCostJpy: -1, amountAJpy: 0 },
        ],
      }),
    ).toThrow();
  });
});
