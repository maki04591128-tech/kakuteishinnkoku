import { describe, expect, it } from "vitest";
import { estimateOccasionalIncome } from "./occasionalIncome";

describe("estimateOccasionalIncome", () => {
  it("生命保険の満期返戻金の例(差引額が特別控除額50万円を超える)", () => {
    // 満期返戻金300万円-払込保険料200万円=100万円、特別控除50万円を差し引くと50万円
    const result = estimateOccasionalIncome({
      totalRevenueJpy: 3_000_000,
      expensesJpy: 2_000_000,
    });
    expect(result.specialDeductionJpy.toNumber()).toBe(500_000);
    expect(result.occasionalIncomeJpy.toNumber()).toBe(500_000);
    expect(result.taxableAmountJpy.toNumber()).toBe(250_000);
  });

  it("差引額が特別控除額50万円以下の場合は特別控除額もその金額に圧縮され、一時所得は0円", () => {
    const result = estimateOccasionalIncome({
      totalRevenueJpy: 400_000,
      expensesJpy: 100_000,
    });
    expect(result.specialDeductionJpy.toNumber()).toBe(300_000);
    expect(result.occasionalIncomeJpy.toNumber()).toBe(0);
    expect(result.taxableAmountJpy.toNumber()).toBe(0);
  });

  it("支出額0円(懸賞金等)は総収入金額から特別控除額50万円を差し引くのみ", () => {
    const result = estimateOccasionalIncome({
      totalRevenueJpy: 800_000,
      expensesJpy: 0,
    });
    expect(result.specialDeductionJpy.toNumber()).toBe(500_000);
    expect(result.occasionalIncomeJpy.toNumber()).toBe(300_000);
    expect(result.taxableAmountJpy.toNumber()).toBe(150_000);
  });

  it("奇数円の一時所得は2分の1にした際にDecimalの端数をそのまま保持する", () => {
    const result = estimateOccasionalIncome({
      totalRevenueJpy: 1_500_001,
      expensesJpy: 0,
    });
    // 1,500,001-500,000=1,000,001 -> 1,000,001/2=500,000.5
    expect(result.occasionalIncomeJpy.toNumber()).toBe(1_000_001);
    expect(result.taxableAmountJpy.toNumber()).toBeCloseTo(500_000.5, 5);
  });

  it("総収入金額0円は一時所得0円", () => {
    const result = estimateOccasionalIncome({
      totalRevenueJpy: 0,
      expensesJpy: 0,
    });
    expect(result.specialDeductionJpy.toNumber()).toBe(0);
    expect(result.occasionalIncomeJpy.toNumber()).toBe(0);
    expect(result.taxableAmountJpy.toNumber()).toBe(0);
  });

  it("総収入金額が負の値だとエラーになる", () => {
    expect(() =>
      estimateOccasionalIncome({
        totalRevenueJpy: -1,
        expensesJpy: 0,
      }),
    ).toThrow();
  });

  it("支出した金額が総収入金額を超える場合はエラーになる", () => {
    expect(() =>
      estimateOccasionalIncome({
        totalRevenueJpy: 100_000,
        expensesJpy: 200_000,
      }),
    ).toThrow();
  });
});
