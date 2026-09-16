import { describe, expect, it } from "vitest";
import { calculateForeignTaxCredit } from "./foreignTaxCredit";

describe("calculateForeignTaxCredit", () => {
  it("外国所得税額が限度額の範囲内ならそのまま全額控除できる", () => {
    // 所得税額80万円・所得総額500万円・国外所得50万円 → 限度額 80万×(50/500)=8万円
    const result = calculateForeignTaxCredit({
      currentYear: 2025,
      incomeTaxJpy: 800_000,
      totalIncomeJpy: 5_000_000,
      foreignSourceIncomeJpy: 500_000,
      foreignIncomeTaxPaidJpy: 50_000,
    });

    expect(result.incomeTaxLimitJpy.toString()).toBe("80000");
    expect(result.reconstructionSurtaxLimitJpy.toString()).toBe("1680");
    expect(result.residentTaxLimitJpy.toString()).toBe("24000");
    expect(result.totalLimitJpy.toString()).toBe("105680");
    expect(result.creditFromCurrentYearJpy.toString()).toBe("50000");
    expect(result.totalCreditJpy.toString()).toBe("50000");
    expect(result.newExcessForeignTaxJpy.toString()).toBe("0");
    expect(result.carryforwardToNextYear).toEqual([]);
  });

  it("外国所得税額が限度額を超える場合は限度額までしか控除できず、超過額は翌年に繰り越される", () => {
    const result = calculateForeignTaxCredit({
      currentYear: 2025,
      incomeTaxJpy: 100_000,
      totalIncomeJpy: 5_000_000,
      foreignSourceIncomeJpy: 500_000,
      foreignIncomeTaxPaidJpy: 50_000,
    });

    // 限度額 = 100,000×(500,000/5,000,000)×1.321 = 13,210
    expect(result.totalLimitJpy.toString()).toBe("13210");
    expect(result.creditFromCurrentYearJpy.toString()).toBe("13210");
    expect(result.totalCreditJpy.toString()).toBe("13210");
    expect(result.newExcessForeignTaxJpy.toString()).toBe("36790");
    expect(result.carryforwardToNextYear.map((c) => c.originYear)).toEqual([2025]);
    expect(result.carryforwardToNextYear[0].remainingAmountJpy.toString()).toBe("36790");
  });

  it("国外所得金額が所得総額を超える場合は所得総額を上限とする(割合は1)", () => {
    const result = calculateForeignTaxCredit({
      currentYear: 2025,
      incomeTaxJpy: 100_000,
      totalIncomeJpy: 300_000,
      foreignSourceIncomeJpy: 1_000_000,
      foreignIncomeTaxPaidJpy: 10_000,
    });

    expect(result.incomeTaxLimitJpy.toString()).toBe("100000");
    expect(result.creditFromCurrentYearJpy.toString()).toBe("10000");
  });

  it("所得総額が0の場合は限度額も0になる(0除算にならない)", () => {
    const result = calculateForeignTaxCredit({
      currentYear: 2025,
      incomeTaxJpy: 0,
      totalIncomeJpy: 0,
      foreignSourceIncomeJpy: 0,
      foreignIncomeTaxPaidJpy: 5_000,
    });

    expect(result.totalLimitJpy.toString()).toBe("0");
    expect(result.creditFromCurrentYearJpy.toString()).toBe("0");
    expect(result.newExcessForeignTaxJpy.toString()).toBe("5000");
  });

  it("当年の限度額に余りがあれば繰越控除限度超過額の充当に使える(発生年の古い順)", () => {
    const result = calculateForeignTaxCredit({
      currentYear: 2025,
      incomeTaxJpy: 800_000,
      totalIncomeJpy: 5_000_000,
      foreignSourceIncomeJpy: 500_000,
      foreignIncomeTaxPaidJpy: 50_000,
      carryforwardEntries: [
        { originYear: 2023, remainingAmountJpy: 15_000 },
        { originYear: 2024, remainingAmountJpy: 25_000 },
      ],
    });

    // 限度額105,680のうち当年分50,000控除後、残り55,680 > 繰越40,000 → 全額充当
    expect(result.creditFromCurrentYearJpy.toString()).toBe("50000");
    expect(result.creditFromCarryforwardJpy.toString()).toBe("40000");
    expect(result.totalCreditJpy.toString()).toBe("90000");
    expect(result.usedCarryforwardByOriginYear).toEqual([
      { originYear: 2023, usedAmountJpy: expect.anything() },
      { originYear: 2024, usedAmountJpy: expect.anything() },
    ]);
    expect(
      result.usedCarryforwardByOriginYear.map((u) => u.usedAmountJpy.toString()),
    ).toEqual(["15000", "25000"]);
    expect(result.carryforwardToNextYear).toEqual([]);
  });

  it("限度額の残りより繰越控除限度超過額が大きい場合は使い切れず残額を翌年に繰り越す", () => {
    const result = calculateForeignTaxCredit({
      currentYear: 2025,
      incomeTaxJpy: 100_000,
      totalIncomeJpy: 5_000_000,
      foreignSourceIncomeJpy: 500_000,
      foreignIncomeTaxPaidJpy: 50_000,
      carryforwardEntries: [{ originYear: 2024, remainingAmountJpy: 40_000 }],
    });

    // 限度額13,210を当年分の控除で使い切るため、繰越分への充当は0
    expect(result.creditFromCurrentYearJpy.toString()).toBe("13210");
    expect(result.creditFromCarryforwardJpy.toString()).toBe("0");
    expect(result.carryforwardToNextYear).toEqual([
      { originYear: 2024, remainingAmountJpy: expect.anything() },
      { originYear: 2025, remainingAmountJpy: expect.anything() },
    ]);
    const byOrigin = new Map(
      result.carryforwardToNextYear.map((c) => [c.originYear, c.remainingAmountJpy.toString()]),
    );
    expect(byOrigin.get(2024)).toBe("40000");
    expect(byOrigin.get(2025)).toBe("36790");
  });

  it("発生年から3年を超えた繰越控除限度超過額は控除に使えず期限切れになる", () => {
    const result = calculateForeignTaxCredit({
      currentYear: 2028,
      incomeTaxJpy: 800_000,
      totalIncomeJpy: 5_000_000,
      foreignSourceIncomeJpy: 500_000,
      foreignIncomeTaxPaidJpy: 0,
      carryforwardEntries: [{ originYear: 2024, remainingAmountJpy: 40_000 }],
    });

    expect(result.creditFromCarryforwardJpy.toString()).toBe("0");
    expect(result.expiredCarryforwardByOriginYear).toEqual([
      { originYear: 2024, expiredAmountJpy: expect.anything() },
    ]);
    expect(result.expiredCarryforwardByOriginYear[0].expiredAmountJpy.toString()).toBe("40000");
    expect(result.carryforwardToNextYear).toEqual([]);
  });

  it("負の値を渡すとエラーになる", () => {
    expect(() =>
      calculateForeignTaxCredit({
        currentYear: 2025,
        incomeTaxJpy: -1,
        totalIncomeJpy: 5_000_000,
        foreignSourceIncomeJpy: 500_000,
        foreignIncomeTaxPaidJpy: 50_000,
      }),
    ).toThrow();
  });
});
