import { describe, expect, it } from "vitest";
import {
  calculateHomeReplacementLoss,
  calculateHomeReplacementLossCarryforward,
} from "./homeReplacementLossCarryforward";

const baseInput = {
  transferPriceJpy: 20_000_000,
  acquisitionCostJpy: 28_000_000,
  transferExpensesJpy: 1_000_000,
  ownershipYears: 10,
  oldSiteAreaSqm: 200,
  newHomeFloorAreaSqm: 80,
  newHomeMortgageExists: true,
  movedInByDeadline: true,
  otherRequirementsEligible: true,
};

describe("calculateHomeReplacementLoss", () => {
  it("全要件を満たし敷地面積が500㎡以下なら、譲渡損失額全額が対象になる", () => {
    const result = calculateHomeReplacementLoss(baseInput);

    expect(result.transferLossJpy.toString()).toBe("9000000");
    expect(result.ownershipPeriodEligible).toBe(true);
    expect(result.floorAreaEligible).toBe(true);
    expect(result.siteAreaExceeded).toBe(false);
    expect(result.siteAreaProrationRatio.toString()).toBe("1");
    expect(result.eligible).toBe(true);
    expect(result.eligibleLossJpy.toString()).toBe("9000000");
    expect(result.notes).toHaveLength(0);
  });

  it("旧居宅の敷地面積が500㎡を超える場合、超過部分に対応する額を除いた按分額のみが対象になる", () => {
    const result = calculateHomeReplacementLoss({ ...baseInput, oldSiteAreaSqm: 1000 });

    expect(result.siteAreaExceeded).toBe(true);
    expect(result.siteAreaProrationRatio.toString()).toBe("0.5");
    expect(result.eligible).toBe(true);
    // 9,000,000 * (500/1000) = 4,500,000
    expect(result.eligibleLossJpy.toString()).toBe("4500000");
    expect(result.notes.some((n) => n.includes("敷地面積"))).toBe(true);
  });

  it("所有期間が5年以下の場合は対象外になる", () => {
    const result = calculateHomeReplacementLoss({ ...baseInput, ownershipYears: 5 });

    expect(result.ownershipPeriodEligible).toBe(false);
    expect(result.eligible).toBe(false);
    expect(result.eligibleLossJpy.toString()).toBe("0");
    expect(result.notes.some((n) => n.includes("所有期間"))).toBe(true);
  });

  it("買換資産の床面積が50㎡未満の場合は対象外になる", () => {
    const result = calculateHomeReplacementLoss({ ...baseInput, newHomeFloorAreaSqm: 45 });

    expect(result.floorAreaEligible).toBe(false);
    expect(result.eligible).toBe(false);
    expect(result.eligibleLossJpy.toString()).toBe("0");
    expect(result.notes.some((n) => n.includes("床面積"))).toBe(true);
  });

  it("買換資産取得年の住宅ローンが無い場合は対象外になる", () => {
    const result = calculateHomeReplacementLoss({ ...baseInput, newHomeMortgageExists: false });

    expect(result.eligible).toBe(false);
    expect(result.eligibleLossJpy.toString()).toBe("0");
  });

  it("買換資産への居住期限を満たさない場合は対象外になる", () => {
    const result = calculateHomeReplacementLoss({ ...baseInput, movedInByDeadline: false });

    expect(result.eligible).toBe(false);
    expect(result.eligibleLossJpy.toString()).toBe("0");
  });

  it("その他の要件を確認していない場合は対象外になる", () => {
    const result = calculateHomeReplacementLoss({
      ...baseInput,
      otherRequirementsEligible: false,
    });

    expect(result.eligible).toBe(false);
    expect(result.eligibleLossJpy.toString()).toBe("0");
  });

  it("譲渡益が生じている場合は対象外になる", () => {
    const result = calculateHomeReplacementLoss({
      ...baseInput,
      transferPriceJpy: 30_000_000,
      acquisitionCostJpy: 20_000_000,
    });

    expect(result.transferLossJpy.toString()).toBe("0");
    expect(result.eligible).toBe(false);
    expect(result.eligibleLossJpy.toString()).toBe("0");
  });

  it("金額・面積が負の場合や所有期間が整数でない場合はエラーになる", () => {
    expect(() =>
      calculateHomeReplacementLoss({ ...baseInput, transferPriceJpy: -1 }),
    ).toThrow();
    expect(() =>
      calculateHomeReplacementLoss({ ...baseInput, oldSiteAreaSqm: -1 }),
    ).toThrow();
    expect(() => calculateHomeReplacementLoss({ ...baseInput, ownershipYears: 5.5 })).toThrow();
    expect(() => calculateHomeReplacementLoss({ ...baseInput, ownershipYears: -1 })).toThrow();
  });
});

describe("calculateHomeReplacementLossCarryforward", () => {
  it("当年発生分の損益通算対象額が総所得金額等以下なら全額その年に控除でき、繰越は発生しない", () => {
    const result = calculateHomeReplacementLossCarryforward(2026, 3_000_000, 5_000_000, true, []);
    expect(result.carryforwardIncomeLimitExceeded).toBe(false);
    expect(result.carryforwardMortgageRequirementUnmet).toBe(false);
    expect(result.carryforwardBlocked).toBe(false);
    expect(result.totalCarryforwardUsedJpy.toString()).toBe("0");
    expect(result.currentYearLossUsedJpy.toString()).toBe("3000000");
    expect(result.totalDeductionAppliedJpy.toString()).toBe("3000000");
    expect(result.taxableIncomeAfterCarryforwardJpy.toString()).toBe("2000000");
    expect(result.newLossJpy.toString()).toBe("0");
    expect(result.carryforwardToNextYear).toHaveLength(0);
  });

  it("当年発生分が総所得金額等を超える場合、超過額が翌年以後への新規繰越になる", () => {
    const result = calculateHomeReplacementLossCarryforward(2026, 8_000_000, 5_000_000, true, []);
    expect(result.currentYearLossUsedJpy.toString()).toBe("5000000");
    expect(result.taxableIncomeAfterCarryforwardJpy.toString()).toBe("0");
    expect(result.newLossJpy.toString()).toBe("3000000");
    expect(result.carryforwardToNextYear[0].remainingAmountJpy.toString()).toBe("3000000");
  });

  it("発生年の古い順に繰越譲渡損失を総所得金額等から控除し、残りを当年発生分に充てる", () => {
    const result = calculateHomeReplacementLossCarryforward(2026, 1_000_000, 3_000_000, true, [
      { originYear: 2024, remainingAmountJpy: 1_000_000 },
      { originYear: 2025, remainingAmountJpy: 1_500_000 },
    ]);

    expect(result.usedCarryforwardByOriginYear[0].usedAmountJpy.toString()).toBe("1000000");
    expect(result.usedCarryforwardByOriginYear[1].usedAmountJpy.toString()).toBe("1500000");
    expect(result.totalCarryforwardUsedJpy.toString()).toBe("2500000");
    expect(result.currentYearLossUsedJpy.toString()).toBe("500000");
    expect(result.totalDeductionAppliedJpy.toString()).toBe("3000000");
    expect(result.taxableIncomeAfterCarryforwardJpy.toString()).toBe("0");
    expect(result.newLossJpy.toString()).toBe("500000");
  });

  it("合計所得金額が3,000万円を超える年は繰越控除(前年以前分)を使用できないが、当年発生分の損益通算はそのまま適用できる", () => {
    const result = calculateHomeReplacementLossCarryforward(2026, 5_000_000, 35_000_000, true, [
      { originYear: 2025, remainingAmountJpy: 2_000_000 },
    ]);

    expect(result.carryforwardIncomeLimitExceeded).toBe(true);
    expect(result.carryforwardBlocked).toBe(true);
    expect(result.usedCarryforwardByOriginYear).toHaveLength(0);
    expect(result.totalCarryforwardUsedJpy.toString()).toBe("0");
    expect(result.currentYearLossUsedJpy.toString()).toBe("5000000");
    const carried2025 = result.carryforwardToNextYear.find((c) => c.originYear === 2025);
    expect(carried2025?.remainingAmountJpy.toString()).toBe("2000000");
  });

  it("買換資産の住宅ローン(10年以上)がその年の12月31日時点で無い場合、繰越控除(前年以前分)を使用できないが、当年発生分の損益通算はそのまま適用できる", () => {
    const result = calculateHomeReplacementLossCarryforward(2026, 5_000_000, 5_000_000, false, [
      { originYear: 2025, remainingAmountJpy: 2_000_000 },
    ]);

    expect(result.carryforwardIncomeLimitExceeded).toBe(false);
    expect(result.carryforwardMortgageRequirementUnmet).toBe(true);
    expect(result.carryforwardBlocked).toBe(true);
    expect(result.usedCarryforwardByOriginYear).toHaveLength(0);
    expect(result.currentYearLossUsedJpy.toString()).toBe("5000000");
    const carried2025 = result.carryforwardToNextYear.find((c) => c.originYear === 2025);
    expect(carried2025?.remainingAmountJpy.toString()).toBe("2000000");
  });

  it("発生年から3年を超えた繰越譲渡損失は控除に使えず期限切れになる", () => {
    const result = calculateHomeReplacementLossCarryforward(2026, 0, 500_000, true, [
      { originYear: 2021, remainingAmountJpy: 300_000 },
      { originYear: 2024, remainingAmountJpy: 200_000 },
    ]);

    expect(result.expiredByOriginYear[0].expiredAmountJpy.toString()).toBe("300000");
    expect(result.usedCarryforwardByOriginYear[0].usedAmountJpy.toString()).toBe("200000");
  });

  it("繰越譲渡損失が枠を使い切ってしまう場合、残りは翌年に繰り越される", () => {
    const result = calculateHomeReplacementLossCarryforward(2026, 0, 100_000, true, [
      { originYear: 2025, remainingAmountJpy: 400_000 },
    ]);

    expect(result.totalCarryforwardUsedJpy.toString()).toBe("100000");
    expect(result.carryforwardToNextYear[0].remainingAmountJpy.toString()).toBe("300000");
  });

  it("負の入力値はエラーになる", () => {
    expect(() =>
      calculateHomeReplacementLossCarryforward(2026, -1, 100_000, true, []),
    ).toThrow();
    expect(() =>
      calculateHomeReplacementLossCarryforward(2026, 0, -1, true, []),
    ).toThrow();
  });
});
