import { describe, expect, it } from "vitest";
import {
  estimateEnergySavingRenovationDeduction,
  type EnergySavingRenovationDeductionInput,
} from "./energySavingRenovationDeduction";

function baseInput(
  overrides: Partial<EnergySavingRenovationDeductionInput> = {},
): EnergySavingRenovationDeductionInput {
  return {
    residenceYear: 2025,
    floorAreaCategory: "AT_LEAST_50",
    totalIncomeJpy: 5_000_000,
    standardCostJpy: 1_000_000,
    includesSolarPanelWork: false,
    otherRelatedWorkCostJpy: 0,
    workCompletedWithinSixMonths: true,
    atLeastHalfCostForOwnResidence: true,
    usedSameCreditInPastThreeYears: false,
    ...overrides,
  };
}

describe("estimateEnergySavingRenovationDeduction", () => {
  it("控除対象限度額以下の場合はA(10%)のみが控除額になる", () => {
    const result = estimateEnergySavingRenovationDeduction(baseInput());

    expect(result.eligible).toBe(true);
    expect(result.amountAJpy.toNumber()).toBe(1_000_000);
    expect(result.amountBJpy.toNumber()).toBe(0);
    expect(result.creditJpy.toNumber()).toBe(100_000);
  });

  it("控除対象限度額(250万円)を超える部分はB(5%)として計算する", () => {
    const result = estimateEnergySavingRenovationDeduction(
      baseInput({ standardCostJpy: 4_000_000 }),
    );

    expect(result.eligible).toBe(true);
    expect(result.controlLimitJpy.toNumber()).toBe(2_500_000);
    expect(result.amountAJpy.toNumber()).toBe(2_500_000);
    expect(result.amountBJpy.toNumber()).toBe(1_500_000);
    // A: 2,500,000*10%=250,000 / B: 1,500,000*5%=75,000
    expect(result.creditJpy.toNumber()).toBe(325_000);
  });

  it("太陽光発電設備設置工事を含む場合は控除対象限度額が350万円になる", () => {
    const result = estimateEnergySavingRenovationDeduction(
      baseInput({ standardCostJpy: 3_000_000, includesSolarPanelWork: true }),
    );

    expect(result.eligible).toBe(true);
    expect(result.controlLimitJpy.toNumber()).toBe(3_500_000);
    expect(result.amountAJpy.toNumber()).toBe(3_000_000);
    expect(result.amountBJpy.toNumber()).toBe(0);
    expect(result.creditJpy.toNumber()).toBe(300_000);
  });

  it("Bは関連工事費用を合算するが、標準的な費用の額(頭打ち前)を上限とする", () => {
    // 標準的な費用の額が限度額以下でも、関連工事費用込みのBが標準的な費用の額自体で頭打ちになる
    const result = estimateEnergySavingRenovationDeduction(
      baseInput({ standardCostJpy: 1_000_000, otherRelatedWorkCostJpy: 5_000_000 }),
    );

    expect(result.eligible).toBe(true);
    expect(result.amountAJpy.toNumber()).toBe(1_000_000);
    // (1) 0(超過分無し)+5,000,000=5,000,000 と (2) 1,000,000 のいずれか低い方
    expect(result.amountBJpy.toNumber()).toBe(1_000_000);
    expect(result.creditJpy.toNumber()).toBe(150_000);
  });

  it("Bが1,000万円からAを控除した限度額を超える場合は頭打ちにする", () => {
    const result = estimateEnergySavingRenovationDeduction(
      baseInput({ standardCostJpy: 8_000_000, otherRelatedWorkCostJpy: 3_000_000 }),
    );

    expect(result.eligible).toBe(true);
    expect(result.amountAJpy.toNumber()).toBe(2_500_000);
    // (1) 5,500,000+3,000,000=8,500,000 と (2) 8,000,000 → 8,000,000だが
    // 1,000万円-250万円=750万円の限度で頭打ち
    expect(result.amountBJpy.toNumber()).toBe(7_500_000);
    expect(result.creditJpy.toNumber()).toBe(625_000);
    expect(result.notes.some((n) => n.includes("頭打ちにした"))).toBe(true);
  });

  it("合計所得金額の上限は令和6年(2024年)分以後2,000万円、令和5年(2023年)分以前は3,000万円", () => {
    const before = estimateEnergySavingRenovationDeduction(
      baseInput({ residenceYear: 2023, totalIncomeJpy: 25_000_000 }),
    );
    const from2024 = estimateEnergySavingRenovationDeduction(
      baseInput({ residenceYear: 2024, totalIncomeJpy: 25_000_000 }),
    );

    expect(before.eligible).toBe(true);
    expect(from2024.eligible).toBe(false);
  });

  it("床面積40〜50平方メートル未満は令和8年(2026年)以後の居住のみ対象", () => {
    const tooEarly = estimateEnergySavingRenovationDeduction(
      baseInput({ residenceYear: 2025, floorAreaCategory: "FROM_40_TO_50", totalIncomeJpy: 9_000_000 }),
    );
    const ok = estimateEnergySavingRenovationDeduction(
      baseInput({ residenceYear: 2026, floorAreaCategory: "FROM_40_TO_50", totalIncomeJpy: 9_000_000 }),
    );
    const tooHighIncome = estimateEnergySavingRenovationDeduction(
      baseInput({ residenceYear: 2026, floorAreaCategory: "FROM_40_TO_50", totalIncomeJpy: 11_000_000 }),
    );

    expect(tooEarly.eligible).toBe(false);
    expect(ok.eligible).toBe(true);
    expect(tooHighIncome.eligible).toBe(false);
  });

  it("令和4年(2022年)より前に居住の用に供した場合は対象外", () => {
    const result = estimateEnergySavingRenovationDeduction(baseInput({ residenceYear: 2021 }));
    expect(result.eligible).toBe(false);
  });

  it("適用期限(令和10年(2028年)12月31日)を過ぎた場合は対象外", () => {
    const result = estimateEnergySavingRenovationDeduction(baseInput({ residenceYear: 2029 }));
    expect(result.eligible).toBe(false);
  });

  it("標準的な費用の額が50万円以下の場合は対象外", () => {
    const result = estimateEnergySavingRenovationDeduction(baseInput({ standardCostJpy: 500_000 }));
    expect(result.eligible).toBe(false);
  });

  it("工事完了から6か月以内に居住していない場合は対象外", () => {
    const result = estimateEnergySavingRenovationDeduction(
      baseInput({ workCompletedWithinSixMonths: false }),
    );
    expect(result.eligible).toBe(false);
  });

  it("工事費用の半分以上が自己居住用でない場合は対象外", () => {
    const result = estimateEnergySavingRenovationDeduction(
      baseInput({ atLeastHalfCostForOwnResidence: false }),
    );
    expect(result.eligible).toBe(false);
  });

  it("前年以前3年内に同一住宅で本控除を適用済みの場合は対象外", () => {
    const result = estimateEnergySavingRenovationDeduction(
      baseInput({ usedSameCreditInPastThreeYears: true }),
    );
    expect(result.eligible).toBe(false);
  });

  it("負の値を入力するとエラーになる", () => {
    expect(() => estimateEnergySavingRenovationDeduction(baseInput({ standardCostJpy: -1 }))).toThrow();
  });
});
