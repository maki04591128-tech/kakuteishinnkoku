import { describe, expect, it } from "vitest";
import { calculateCasualtyLossCarryforward } from "./casualtyLossCarryforward";

describe("calculateCasualtyLossCarryforward", () => {
  it("雑損控除額が総所得金額等以下なら全額その年の所得から控除でき、繰越は発生しない", () => {
    const result = calculateCasualtyLossCarryforward(2026, 300_000, 5_000_000, []);
    expect(result.totalCarryforwardUsedJpy.toString()).toBe("0");
    expect(result.currentYearDeductionUsedJpy.toString()).toBe("300000");
    expect(result.totalDeductionAppliedJpy.toString()).toBe("300000");
    expect(result.taxableIncomeAfterCarryforwardJpy.toString()).toBe("4700000");
    expect(result.newLossJpy.toString()).toBe("0");
    expect(result.carryforwardToNextYear).toHaveLength(0);
  });

  it("雑損控除額が総所得金額等を超える場合、超過額が翌年以後への新規繰越になる", () => {
    const result = calculateCasualtyLossCarryforward(2026, 3_000_000, 2_000_000, []);
    expect(result.currentYearDeductionUsedJpy.toString()).toBe("2000000");
    expect(result.totalDeductionAppliedJpy.toString()).toBe("2000000");
    expect(result.taxableIncomeAfterCarryforwardJpy.toString()).toBe("0");
    expect(result.newLossJpy.toString()).toBe("1000000");
    expect(result.carryforwardToNextYear).toEqual([
      { originYear: 2026, remainingAmountJpy: expect.anything() },
    ]);
    expect(result.carryforwardToNextYear[0].remainingAmountJpy.toString()).toBe(
      "1000000",
    );
  });

  it("発生年の古い順に繰越雑損失を総所得金額等から控除し、残りを当年分に充てる", () => {
    const result = calculateCasualtyLossCarryforward(2026, 500_000, 1_000_000, [
      { originYear: 2024, remainingAmountJpy: 300_000 },
      { originYear: 2025, remainingAmountJpy: 400_000 },
    ]);

    expect(result.usedCarryforwardByOriginYear).toEqual([
      { originYear: 2024, usedAmountJpy: expect.anything() },
      { originYear: 2025, usedAmountJpy: expect.anything() },
    ]);
    expect(result.usedCarryforwardByOriginYear[0].usedAmountJpy.toString()).toBe(
      "300000",
    );
    expect(result.usedCarryforwardByOriginYear[1].usedAmountJpy.toString()).toBe(
      "400000",
    );
    expect(result.totalCarryforwardUsedJpy.toString()).toBe("700000");

    // 総所得金額等1,000,000のうち繰越控除で700,000使用済み、残り300,000が当年分に充当される
    expect(result.currentYearDeductionUsedJpy.toString()).toBe("300000");
    expect(result.totalDeductionAppliedJpy.toString()).toBe("1000000");
    expect(result.taxableIncomeAfterCarryforwardJpy.toString()).toBe("0");
    expect(result.newLossJpy.toString()).toBe("200000");
    expect(result.carryforwardToNextYear).toEqual([
      { originYear: 2026, remainingAmountJpy: expect.anything() },
    ]);
  });

  it("発生年から3年を超えた繰越雑損失は控除に使えず期限切れになる", () => {
    // 2021年分の雑損失は2022〜2024年分でしか使えないため、2026年分では期限切れ
    const result = calculateCasualtyLossCarryforward(2026, 0, 200_000, [
      { originYear: 2021, remainingAmountJpy: 150_000 },
      { originYear: 2024, remainingAmountJpy: 50_000 },
    ]);

    expect(result.expiredByOriginYear).toEqual([
      { originYear: 2021, expiredAmountJpy: expect.anything() },
    ]);
    expect(result.expiredByOriginYear[0].expiredAmountJpy.toString()).toBe(
      "150000",
    );
    expect(result.usedCarryforwardByOriginYear).toEqual([
      { originYear: 2024, usedAmountJpy: expect.anything() },
    ]);
    expect(result.usedCarryforwardByOriginYear[0].usedAmountJpy.toString()).toBe(
      "50000",
    );
    expect(result.taxableIncomeAfterCarryforwardJpy.toString()).toBe("150000");
  });

  it("繰越雑損失が枠を使い切ってしまう場合、残りは翌年に繰り越される", () => {
    const result = calculateCasualtyLossCarryforward(2026, 0, 100_000, [
      { originYear: 2025, remainingAmountJpy: 400_000 },
    ]);

    expect(result.totalCarryforwardUsedJpy.toString()).toBe("100000");
    expect(result.taxableIncomeAfterCarryforwardJpy.toString()).toBe("0");
    expect(result.newLossJpy.toString()).toBe("0");
    expect(result.carryforwardToNextYear).toEqual([
      { originYear: 2025, remainingAmountJpy: expect.anything() },
    ]);
    expect(result.carryforwardToNextYear[0].remainingAmountJpy.toString()).toBe(
      "300000",
    );
  });

  it("負の入力値はエラーになる", () => {
    expect(() => calculateCasualtyLossCarryforward(2026, -1, 100_000, [])).toThrow();
    expect(() => calculateCasualtyLossCarryforward(2026, 0, -1, [])).toThrow();
  });
});
