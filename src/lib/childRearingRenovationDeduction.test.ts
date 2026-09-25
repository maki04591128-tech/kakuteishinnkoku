import { describe, expect, it } from "vitest";
import {
  estimateChildRearingRenovationDeduction,
  type ChildRearingRenovationDeductionInput,
} from "./childRearingRenovationDeduction";

function baseInput(
  overrides: Partial<ChildRearingRenovationDeductionInput> = {},
): ChildRearingRenovationDeductionInput {
  return {
    residenceYear: 2025,
    floorAreaCategory: "AT_LEAST_50",
    totalIncomeJpy: 5_000_000,
    hasDependentUnder19: true,
    hasSpouse: false,
    taxpayerAgeUnder40: false,
    spouseAgeUnder40: false,
    childSafetyWork: true,
    openKitchenWork: false,
    securityOpeningWork: false,
    storageWork: false,
    soundproofingWork: false,
    partitionWallWork: false,
    standardCostJpy: 1_000_000,
    otherRelatedWorkCostJpy: 0,
    workCompletedWithinSixMonths: true,
    atLeastHalfCostForOwnResidence: true,
    usedSameCreditInPastThreeYears: false,
    ...overrides,
  };
}

describe("estimateChildRearingRenovationDeduction", () => {
  it("控除対象限度額以下の場合はA(10%)のみが控除額になる", () => {
    const result = estimateChildRearingRenovationDeduction(baseInput());

    expect(result.eligible).toBe(true);
    expect(result.amountAJpy.toNumber()).toBe(1_000_000);
    expect(result.amountBJpy.toNumber()).toBe(0);
    expect(result.creditJpy.toNumber()).toBe(100_000);
  });

  it("控除対象限度額(250万円)を超える部分はB(5%)として計算する", () => {
    const result = estimateChildRearingRenovationDeduction(
      baseInput({ standardCostJpy: 3_500_000 }),
    );

    expect(result.eligible).toBe(true);
    expect(result.controlLimitJpy.toNumber()).toBe(2_500_000);
    expect(result.amountAJpy.toNumber()).toBe(2_500_000);
    expect(result.amountBJpy.toNumber()).toBe(1_000_000);
    // A: 2,500,000*10%=250,000 / B: 1,000,000*5%=50,000
    expect(result.creditJpy.toNumber()).toBe(300_000);
  });

  it("Bは関連工事費用を合算するが、標準的な費用の額(頭打ち前)を上限とする", () => {
    const result = estimateChildRearingRenovationDeduction(
      baseInput({ standardCostJpy: 1_000_000, otherRelatedWorkCostJpy: 5_000_000 }),
    );

    expect(result.eligible).toBe(true);
    expect(result.amountAJpy.toNumber()).toBe(1_000_000);
    // (1) 0(超過分無し)+5,000,000=5,000,000 と (2) 1,000,000 のいずれか低い方
    expect(result.amountBJpy.toNumber()).toBe(1_000_000);
    expect(result.creditJpy.toNumber()).toBe(150_000);
  });

  it("Bが1,000万円からAを控除した限度額を超える場合は頭打ちにする", () => {
    const result = estimateChildRearingRenovationDeduction(
      baseInput({ standardCostJpy: 9_000_000, otherRelatedWorkCostJpy: 3_000_000 }),
    );

    expect(result.eligible).toBe(true);
    expect(result.amountAJpy.toNumber()).toBe(2_500_000);
    // (1) 6,500,000+3,000,000=9,500,000 と (2) 9,000,000 → 9,000,000だが
    // 1,000万円-250万円=750万円の限度で頭打ち
    expect(result.amountBJpy.toNumber()).toBe(7_500_000);
    expect(result.creditJpy.toNumber()).toBe(625_000);
    expect(result.notes.some((n) => n.includes("頭打ちにした"))).toBe(true);
  });

  it("合計所得金額の上限は床面積50平方メートル以上で2,000万円", () => {
    const ok = estimateChildRearingRenovationDeduction(baseInput({ totalIncomeJpy: 20_000_000 }));
    const tooHigh = estimateChildRearingRenovationDeduction(
      baseInput({ totalIncomeJpy: 20_000_001 }),
    );

    expect(ok.eligible).toBe(true);
    expect(tooHigh.eligible).toBe(false);
  });

  it("床面積40〜50平方メートル未満は令和8年(2026年)以後の居住のみ対象で、上限は1,000万円", () => {
    const tooEarly = estimateChildRearingRenovationDeduction(
      baseInput({ residenceYear: 2025, floorAreaCategory: "FROM_40_TO_50", totalIncomeJpy: 9_000_000 }),
    );
    const ok = estimateChildRearingRenovationDeduction(
      baseInput({ residenceYear: 2026, floorAreaCategory: "FROM_40_TO_50", totalIncomeJpy: 9_000_000 }),
    );
    const tooHighIncome = estimateChildRearingRenovationDeduction(
      baseInput({ residenceYear: 2026, floorAreaCategory: "FROM_40_TO_50", totalIncomeJpy: 11_000_000 }),
    );

    expect(tooEarly.eligible).toBe(false);
    expect(ok.eligible).toBe(true);
    expect(tooHighIncome.eligible).toBe(false);
  });

  it("19歳未満の扶養親族が無く、配偶者も居ない場合は対象外", () => {
    const result = estimateChildRearingRenovationDeduction(
      baseInput({ hasDependentUnder19: false, hasSpouse: false }),
    );
    expect(result.eligible).toBe(false);
  });

  it("配偶者がいても本人・配偶者ともに40歳以上の場合は対象外", () => {
    const result = estimateChildRearingRenovationDeduction(
      baseInput({
        hasDependentUnder19: false,
        hasSpouse: true,
        taxpayerAgeUnder40: false,
        spouseAgeUnder40: false,
      }),
    );
    expect(result.eligible).toBe(false);
  });

  it("本人が40歳未満で配偶者がいれば扶養親族が無くても対象になる", () => {
    const result = estimateChildRearingRenovationDeduction(
      baseInput({
        hasDependentUnder19: false,
        hasSpouse: true,
        taxpayerAgeUnder40: true,
        spouseAgeUnder40: false,
      }),
    );
    expect(result.eligible).toBe(true);
  });

  it("本人が40歳以上でも配偶者が40歳未満であれば対象になる", () => {
    const result = estimateChildRearingRenovationDeduction(
      baseInput({
        hasDependentUnder19: false,
        hasSpouse: true,
        taxpayerAgeUnder40: false,
        spouseAgeUnder40: true,
      }),
    );
    expect(result.eligible).toBe(true);
  });

  it("対象となる6種類の工事のいずれにも該当しない場合は対象外", () => {
    const result = estimateChildRearingRenovationDeduction(baseInput({ childSafetyWork: false }));
    expect(result.eligible).toBe(false);
  });

  it("6種類のいずれか1つに該当すれば対象になる(対面式キッチンへの取替工事)", () => {
    const result = estimateChildRearingRenovationDeduction(
      baseInput({ childSafetyWork: false, openKitchenWork: true }),
    );
    expect(result.eligible).toBe(true);
  });

  it("令和6年(2024年)4月1日より前の制度開始前は対象外", () => {
    const result = estimateChildRearingRenovationDeduction(baseInput({ residenceYear: 2023 }));
    expect(result.eligible).toBe(false);
  });

  it("適用期限(令和10年(2028年)12月31日)を過ぎた場合は対象外", () => {
    const result = estimateChildRearingRenovationDeduction(baseInput({ residenceYear: 2029 }));
    expect(result.eligible).toBe(false);
  });

  it("標準的な費用の額が50万円以下の場合は対象外", () => {
    const result = estimateChildRearingRenovationDeduction(baseInput({ standardCostJpy: 500_000 }));
    expect(result.eligible).toBe(false);
  });

  it("工事完了から6か月以内に居住していない場合は対象外", () => {
    const result = estimateChildRearingRenovationDeduction(
      baseInput({ workCompletedWithinSixMonths: false }),
    );
    expect(result.eligible).toBe(false);
  });

  it("工事費用の半分以上が自己居住用でない場合は対象外", () => {
    const result = estimateChildRearingRenovationDeduction(
      baseInput({ atLeastHalfCostForOwnResidence: false }),
    );
    expect(result.eligible).toBe(false);
  });

  it("前年以前3年内に同一住宅で本控除を適用済みの場合は対象外", () => {
    const result = estimateChildRearingRenovationDeduction(
      baseInput({ usedSameCreditInPastThreeYears: true }),
    );
    expect(result.eligible).toBe(false);
  });

  it("負の値を入力するとエラーになる", () => {
    expect(() =>
      estimateChildRearingRenovationDeduction(baseInput({ standardCostJpy: -1 })),
    ).toThrow();
  });
});
