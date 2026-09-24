import { describe, expect, it } from "vitest";
import {
  estimateBarrierFreeRenovationDeduction,
  type BarrierFreeRenovationDeductionInput,
} from "./barrierFreeRenovationDeduction";

function baseInput(
  overrides: Partial<BarrierFreeRenovationDeductionInput> = {},
): BarrierFreeRenovationDeductionInput {
  return {
    residenceYear: 2025,
    floorAreaCategory: "AT_LEAST_50",
    totalIncomeJpy: 5_000_000,
    qualifyingPersonCategory: "AGE_50_OR_OLDER",
    standardCostJpy: 1_000_000,
    otherRelatedWorkCostJpy: 0,
    workCompletedWithinSixMonths: true,
    atLeastHalfCostForOwnResidence: true,
    usedSameCreditInPastThreeYears: false,
    ...overrides,
  };
}

describe("estimateBarrierFreeRenovationDeduction", () => {
  it("控除対象限度額以下の場合はA(10%)のみが控除額になる", () => {
    const result = estimateBarrierFreeRenovationDeduction(baseInput());

    expect(result.eligible).toBe(true);
    expect(result.amountAJpy.toNumber()).toBe(1_000_000);
    expect(result.amountBJpy.toNumber()).toBe(0);
    expect(result.creditJpy.toNumber()).toBe(100_000);
  });

  it("控除対象限度額(200万円)を超える部分はB(5%)として計算する", () => {
    const result = estimateBarrierFreeRenovationDeduction(
      baseInput({ standardCostJpy: 3_000_000 }),
    );

    expect(result.eligible).toBe(true);
    expect(result.controlLimitJpy.toNumber()).toBe(2_000_000);
    expect(result.amountAJpy.toNumber()).toBe(2_000_000);
    expect(result.amountBJpy.toNumber()).toBe(1_000_000);
    // A: 2,000,000*10%=200,000 / B: 1,000,000*5%=50,000
    expect(result.creditJpy.toNumber()).toBe(250_000);
  });

  it("Bは関連工事費用を合算するが、標準的な費用の額(頭打ち前)を上限とする", () => {
    const result = estimateBarrierFreeRenovationDeduction(
      baseInput({ standardCostJpy: 1_000_000, otherRelatedWorkCostJpy: 5_000_000 }),
    );

    expect(result.eligible).toBe(true);
    expect(result.amountAJpy.toNumber()).toBe(1_000_000);
    // (1) 0(超過分無し)+5,000,000=5,000,000 と (2) 1,000,000 のいずれか低い方
    expect(result.amountBJpy.toNumber()).toBe(1_000_000);
    expect(result.creditJpy.toNumber()).toBe(150_000);
  });

  it("Bが1,000万円からAを控除した限度額を超える場合は頭打ちにする", () => {
    const result = estimateBarrierFreeRenovationDeduction(
      baseInput({ standardCostJpy: 9_000_000, otherRelatedWorkCostJpy: 3_000_000 }),
    );

    expect(result.eligible).toBe(true);
    expect(result.amountAJpy.toNumber()).toBe(2_000_000);
    // (1) 7,000,000+3,000,000=10,000,000 と (2) 9,000,000 → 9,000,000だが
    // 1,000万円-200万円=800万円の限度で頭打ち
    expect(result.amountBJpy.toNumber()).toBe(8_000_000);
    expect(result.creditJpy.toNumber()).toBe(600_000);
    expect(result.notes.some((n) => n.includes("頭打ちにした"))).toBe(true);
  });

  it("合計所得金額の上限は令和6年(2024年)分以後2,000万円、令和5年(2023年)分以前は3,000万円", () => {
    const before = estimateBarrierFreeRenovationDeduction(
      baseInput({ residenceYear: 2023, totalIncomeJpy: 25_000_000 }),
    );
    const from2024 = estimateBarrierFreeRenovationDeduction(
      baseInput({ residenceYear: 2024, totalIncomeJpy: 25_000_000 }),
    );

    expect(before.eligible).toBe(true);
    expect(from2024.eligible).toBe(false);
  });

  it("床面積40〜50平方メートル未満は令和8年(2026年)以後の居住のみ対象", () => {
    const tooEarly = estimateBarrierFreeRenovationDeduction(
      baseInput({ residenceYear: 2025, floorAreaCategory: "FROM_40_TO_50", totalIncomeJpy: 9_000_000 }),
    );
    const ok = estimateBarrierFreeRenovationDeduction(
      baseInput({ residenceYear: 2026, floorAreaCategory: "FROM_40_TO_50", totalIncomeJpy: 9_000_000 }),
    );
    const tooHighIncome = estimateBarrierFreeRenovationDeduction(
      baseInput({ residenceYear: 2026, floorAreaCategory: "FROM_40_TO_50", totalIncomeJpy: 11_000_000 }),
    );

    expect(tooEarly.eligible).toBe(false);
    expect(ok.eligible).toBe(true);
    expect(tooHighIncome.eligible).toBe(false);
  });

  it("特定個人のいずれにも該当しない場合は対象外", () => {
    const result = estimateBarrierFreeRenovationDeduction(
      baseInput({ qualifyingPersonCategory: "NONE" }),
    );
    expect(result.eligible).toBe(false);
  });

  it("要介護・要支援認定/障害者/高齢者等との同居のいずれでも対象になる", () => {
    for (const category of [
      "CARE_OR_SUPPORT_CERTIFIED",
      "DISABLED",
      "LIVING_WITH_ELDERLY_OR_CERTIFIED_RELATIVE",
    ] as const) {
      const result = estimateBarrierFreeRenovationDeduction(
        baseInput({ qualifyingPersonCategory: category }),
      );
      expect(result.eligible).toBe(true);
    }
  });

  it("令和4年(2022年)より前に居住の用に供した場合は対象外", () => {
    const result = estimateBarrierFreeRenovationDeduction(baseInput({ residenceYear: 2021 }));
    expect(result.eligible).toBe(false);
  });

  it("適用期限(令和10年(2028年)12月31日)を過ぎた場合は対象外", () => {
    const result = estimateBarrierFreeRenovationDeduction(baseInput({ residenceYear: 2029 }));
    expect(result.eligible).toBe(false);
  });

  it("標準的な費用の額が50万円以下の場合は対象外", () => {
    const result = estimateBarrierFreeRenovationDeduction(baseInput({ standardCostJpy: 500_000 }));
    expect(result.eligible).toBe(false);
  });

  it("工事完了から6か月以内に居住していない場合は対象外", () => {
    const result = estimateBarrierFreeRenovationDeduction(
      baseInput({ workCompletedWithinSixMonths: false }),
    );
    expect(result.eligible).toBe(false);
  });

  it("工事費用の半分以上が自己居住用でない場合は対象外", () => {
    const result = estimateBarrierFreeRenovationDeduction(
      baseInput({ atLeastHalfCostForOwnResidence: false }),
    );
    expect(result.eligible).toBe(false);
  });

  it("前年以前3年内に同一住宅で本控除を適用済みの場合は対象外", () => {
    const result = estimateBarrierFreeRenovationDeduction(
      baseInput({ usedSameCreditInPastThreeYears: true }),
    );
    expect(result.eligible).toBe(false);
  });

  it("負の値を入力するとエラーになる", () => {
    expect(() =>
      estimateBarrierFreeRenovationDeduction(baseInput({ standardCostJpy: -1 })),
    ).toThrow();
  });
});
