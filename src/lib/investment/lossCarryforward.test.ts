import { describe, expect, it } from "vitest";
import { calculateLossCarryforward } from "./lossCarryforward";

describe("calculateLossCarryforward", () => {
  it("繰越損失が無ければそのまま課税対象になる", () => {
    const result = calculateLossCarryforward(2026, 300_000, []);
    expect(result.totalUsedJpy.toString()).toBe("0");
    expect(result.taxableGainJpy.toString()).toBe("300000");
    expect(result.newLossJpy.toString()).toBe("0");
    expect(result.carryforwardToNextYear).toHaveLength(0);
  });

  it("当年が譲渡損失の場合は課税対象0円で、翌年以後への新規繰越損失になる", () => {
    const result = calculateLossCarryforward(2026, -500_000, []);
    expect(result.taxableGainJpy.toString()).toBe("0");
    expect(result.newLossJpy.toString()).toBe("500000");
    expect(result.carryforwardToNextYear).toEqual([
      { originYear: 2026, remainingAmountJpy: expect.anything() },
    ]);
    expect(result.carryforwardToNextYear[0].remainingAmountJpy.toString()).toBe(
      "500000",
    );
  });

  it("発生年の古い順に繰越損失を使用する", () => {
    const result = calculateLossCarryforward(2026, 800_000, [
      { originYear: 2024, remainingAmountJpy: 300_000 },
      { originYear: 2025, remainingAmountJpy: 1_000_000 },
    ]);

    expect(result.usedByOriginYear).toEqual([
      { originYear: 2024, usedAmountJpy: expect.anything() },
      { originYear: 2025, usedAmountJpy: expect.anything() },
    ]);
    expect(result.usedByOriginYear[0].usedAmountJpy.toString()).toBe("300000");
    expect(result.usedByOriginYear[1].usedAmountJpy.toString()).toBe("500000");
    expect(result.totalUsedJpy.toString()).toBe("800000");
    expect(result.taxableGainJpy.toString()).toBe("0");

    // 2025年分は 1,000,000 のうち 500,000 使用 → 500,000 が翌年に繰越
    expect(result.carryforwardToNextYear).toHaveLength(1);
    expect(result.carryforwardToNextYear[0]).toMatchObject({ originYear: 2025 });
    expect(
      result.carryforwardToNextYear[0].remainingAmountJpy.toString(),
    ).toBe("500000");
  });

  it("発生年から3年を超えた繰越損失は控除に使えず期限切れになる", () => {
    // 2021年分の損失は2022〜2024年分でしか使えないため、2026年分では期限切れ
    const result = calculateLossCarryforward(2026, 200_000, [
      { originYear: 2021, remainingAmountJpy: 150_000 },
      { originYear: 2024, remainingAmountJpy: 50_000 },
    ]);

    expect(result.expiredByOriginYear).toEqual([
      { originYear: 2021, expiredAmountJpy: expect.anything() },
    ]);
    expect(result.expiredByOriginYear[0].expiredAmountJpy.toString()).toBe(
      "150000",
    );
    expect(result.usedByOriginYear).toEqual([
      { originYear: 2024, usedAmountJpy: expect.anything() },
    ]);
    expect(result.usedByOriginYear[0].usedAmountJpy.toString()).toBe("50000");
    expect(result.taxableGainJpy.toString()).toBe("150000");
  });

  it("控除しきれない繰越損失は当年発生分と合わせて翌年に繰り越す", () => {
    const result = calculateLossCarryforward(2026, -100_000, [
      { originYear: 2025, remainingAmountJpy: 400_000 },
    ]);

    // 当年が損失のため繰越損失は使用しない
    expect(result.totalUsedJpy.toString()).toBe("0");
    expect(result.taxableGainJpy.toString()).toBe("0");
    expect(result.newLossJpy.toString()).toBe("100000");

    const balances = Object.fromEntries(
      result.carryforwardToNextYear.map((c) => [
        c.originYear,
        c.remainingAmountJpy.toString(),
      ]),
    );
    expect(balances).toEqual({ 2025: "400000", 2026: "100000" });
  });
});
