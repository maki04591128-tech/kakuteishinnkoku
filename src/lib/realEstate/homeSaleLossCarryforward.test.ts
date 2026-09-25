import { describe, expect, it } from "vitest";
import {
  calculateHomeSaleLoss,
  calculateHomeSaleLossCarryforward,
} from "./homeSaleLossCarryforward";

describe("calculateHomeSaleLoss", () => {
  it("全要件を満たし譲渡損失が住宅ローン残高との差額以下なら、譲渡損失額全額が対象になる", () => {
    const result = calculateHomeSaleLoss({
      transferPriceJpy: 20_000_000,
      acquisitionCostJpy: 28_000_000,
      transferExpensesJpy: 1_000_000,
      ownershipYears: 10,
      mortgageBalanceJpy: 25_000_000,
      otherRequirementsEligible: true,
    });

    expect(result.transferLossJpy.toString()).toBe("9000000");
    expect(result.ownershipPeriodEligible).toBe(true);
    expect(result.mortgageConditionEligible).toBe(true);
    expect(result.eligible).toBe(true);
    expect(result.offsetLimitJpy.toString()).toBe("5000000");
    expect(result.eligibleLossJpy.toString()).toBe("5000000");
    expect(result.notes).toHaveLength(1);
  });

  it("譲渡損失額が損益通算限度額以下なら譲渡損失額全額が対象になる", () => {
    const result = calculateHomeSaleLoss({
      transferPriceJpy: 20_000_000,
      acquisitionCostJpy: 21_000_000,
      transferExpensesJpy: 500_000,
      ownershipYears: 8,
      mortgageBalanceJpy: 25_000_000,
      otherRequirementsEligible: true,
    });

    expect(result.transferLossJpy.toString()).toBe("1500000");
    expect(result.offsetLimitJpy.toString()).toBe("5000000");
    expect(result.eligibleLossJpy.toString()).toBe("1500000");
    expect(result.notes).toHaveLength(0);
  });

  it("所有期間が5年以下の場合は対象外になる", () => {
    const result = calculateHomeSaleLoss({
      transferPriceJpy: 20_000_000,
      acquisitionCostJpy: 28_000_000,
      transferExpensesJpy: 1_000_000,
      ownershipYears: 5,
      mortgageBalanceJpy: 25_000_000,
      otherRequirementsEligible: true,
    });

    expect(result.ownershipPeriodEligible).toBe(false);
    expect(result.eligible).toBe(false);
    expect(result.eligibleLossJpy.toString()).toBe("0");
    expect(result.notes.some((n) => n.includes("所有期間"))).toBe(true);
  });

  it("住宅ローン残高が譲渡価額以下の場合は対象外になる", () => {
    const result = calculateHomeSaleLoss({
      transferPriceJpy: 20_000_000,
      acquisitionCostJpy: 28_000_000,
      transferExpensesJpy: 1_000_000,
      ownershipYears: 10,
      mortgageBalanceJpy: 18_000_000,
      otherRequirementsEligible: true,
    });

    expect(result.mortgageConditionEligible).toBe(false);
    expect(result.eligible).toBe(false);
    expect(result.offsetLimitJpy.toString()).toBe("0");
    expect(result.eligibleLossJpy.toString()).toBe("0");
  });

  it("その他の要件を確認していない場合は対象外になる", () => {
    const result = calculateHomeSaleLoss({
      transferPriceJpy: 20_000_000,
      acquisitionCostJpy: 28_000_000,
      transferExpensesJpy: 1_000_000,
      ownershipYears: 10,
      mortgageBalanceJpy: 25_000_000,
      otherRequirementsEligible: false,
    });

    expect(result.eligible).toBe(false);
    expect(result.eligibleLossJpy.toString()).toBe("0");
  });

  it("譲渡益が生じている場合は対象外になる", () => {
    const result = calculateHomeSaleLoss({
      transferPriceJpy: 30_000_000,
      acquisitionCostJpy: 20_000_000,
      transferExpensesJpy: 1_000_000,
      ownershipYears: 10,
      mortgageBalanceJpy: 25_000_000,
      otherRequirementsEligible: true,
    });

    expect(result.transferLossJpy.toString()).toBe("0");
    expect(result.eligible).toBe(false);
    expect(result.eligibleLossJpy.toString()).toBe("0");
  });

  it("金額が負の場合や所有期間が整数でない場合はエラーになる", () => {
    const base = {
      transferPriceJpy: 20_000_000,
      acquisitionCostJpy: 28_000_000,
      transferExpensesJpy: 1_000_000,
      ownershipYears: 10,
      mortgageBalanceJpy: 25_000_000,
      otherRequirementsEligible: true,
    };
    expect(() =>
      calculateHomeSaleLoss({ ...base, transferPriceJpy: -1 }),
    ).toThrow();
    expect(() => calculateHomeSaleLoss({ ...base, ownershipYears: 5.5 })).toThrow();
    expect(() => calculateHomeSaleLoss({ ...base, ownershipYears: -1 })).toThrow();
  });
});

describe("calculateHomeSaleLossCarryforward", () => {
  it("当年発生分の損益通算対象額が総所得金額等以下なら全額その年に控除でき、繰越は発生しない", () => {
    const result = calculateHomeSaleLossCarryforward(2026, 3_000_000, 5_000_000, []);
    expect(result.carryforwardIncomeLimitExceeded).toBe(false);
    expect(result.totalCarryforwardUsedJpy.toString()).toBe("0");
    expect(result.currentYearLossUsedJpy.toString()).toBe("3000000");
    expect(result.totalDeductionAppliedJpy.toString()).toBe("3000000");
    expect(result.taxableIncomeAfterCarryforwardJpy.toString()).toBe("2000000");
    expect(result.newLossJpy.toString()).toBe("0");
    expect(result.carryforwardToNextYear).toHaveLength(0);
  });

  it("当年発生分が総所得金額等を超える場合、超過額が翌年以後への新規繰越になる", () => {
    const result = calculateHomeSaleLossCarryforward(2026, 8_000_000, 5_000_000, []);
    expect(result.currentYearLossUsedJpy.toString()).toBe("5000000");
    expect(result.taxableIncomeAfterCarryforwardJpy.toString()).toBe("0");
    expect(result.newLossJpy.toString()).toBe("3000000");
    expect(result.carryforwardToNextYear).toEqual([
      { originYear: 2026, remainingAmountJpy: expect.anything() },
    ]);
    expect(result.carryforwardToNextYear[0].remainingAmountJpy.toString()).toBe(
      "3000000",
    );
  });

  it("発生年の古い順に繰越譲渡損失を総所得金額等から控除し、残りを当年発生分に充てる", () => {
    const result = calculateHomeSaleLossCarryforward(2026, 1_000_000, 3_000_000, [
      { originYear: 2024, remainingAmountJpy: 1_000_000 },
      { originYear: 2025, remainingAmountJpy: 1_500_000 },
    ]);

    expect(result.usedCarryforwardByOriginYear[0].usedAmountJpy.toString()).toBe(
      "1000000",
    );
    expect(result.usedCarryforwardByOriginYear[1].usedAmountJpy.toString()).toBe(
      "1500000",
    );
    expect(result.totalCarryforwardUsedJpy.toString()).toBe("2500000");
    // 総所得金額等3,000,000のうち繰越控除で2,500,000使用済み、残り500,000が当年発生分に充当
    expect(result.currentYearLossUsedJpy.toString()).toBe("500000");
    expect(result.totalDeductionAppliedJpy.toString()).toBe("3000000");
    expect(result.taxableIncomeAfterCarryforwardJpy.toString()).toBe("0");
    expect(result.newLossJpy.toString()).toBe("500000");
  });

  it("合計所得金額が3,000万円を超える年は繰越控除(前年以前分)を使用できないが、当年発生分の損益通算はそのまま適用できる", () => {
    const result = calculateHomeSaleLossCarryforward(2026, 5_000_000, 35_000_000, [
      { originYear: 2025, remainingAmountJpy: 2_000_000 },
    ]);

    expect(result.carryforwardIncomeLimitExceeded).toBe(true);
    expect(result.usedCarryforwardByOriginYear).toHaveLength(0);
    expect(result.totalCarryforwardUsedJpy.toString()).toBe("0");
    expect(result.currentYearLossUsedJpy.toString()).toBe("5000000");
    expect(result.carryforwardToNextYear).toEqual(
      expect.arrayContaining([
        { originYear: 2025, remainingAmountJpy: expect.anything() },
      ]),
    );
    const carried2025 = result.carryforwardToNextYear.find((c) => c.originYear === 2025);
    expect(carried2025?.remainingAmountJpy.toString()).toBe("2000000");
  });

  it("発生年から3年を超えた繰越譲渡損失は控除に使えず期限切れになる", () => {
    const result = calculateHomeSaleLossCarryforward(2026, 0, 500_000, [
      { originYear: 2021, remainingAmountJpy: 300_000 },
      { originYear: 2024, remainingAmountJpy: 200_000 },
    ]);

    expect(result.expiredByOriginYear).toEqual([
      { originYear: 2021, expiredAmountJpy: expect.anything() },
    ]);
    expect(result.expiredByOriginYear[0].expiredAmountJpy.toString()).toBe("300000");
    expect(result.usedCarryforwardByOriginYear[0].usedAmountJpy.toString()).toBe(
      "200000",
    );
  });

  it("繰越譲渡損失が枠を使い切ってしまう場合、残りは翌年に繰り越される", () => {
    const result = calculateHomeSaleLossCarryforward(2026, 0, 100_000, [
      { originYear: 2025, remainingAmountJpy: 400_000 },
    ]);

    expect(result.totalCarryforwardUsedJpy.toString()).toBe("100000");
    expect(result.carryforwardToNextYear[0].remainingAmountJpy.toString()).toBe(
      "300000",
    );
  });

  it("負の入力値はエラーになる", () => {
    expect(() => calculateHomeSaleLossCarryforward(2026, -1, 100_000, [])).toThrow();
    expect(() => calculateHomeSaleLossCarryforward(2026, 0, -1, [])).toThrow();
  });
});
