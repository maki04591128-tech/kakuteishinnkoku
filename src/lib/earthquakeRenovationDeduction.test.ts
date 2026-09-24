import { describe, expect, it } from "vitest";
import { estimateEarthquakeRenovationDeduction } from "./earthquakeRenovationDeduction";

describe("estimateEarthquakeRenovationDeduction", () => {
  it("標準的な工事費用相当額の10%を控除額とする(100円未満切り捨て)", () => {
    const result = estimateEarthquakeRenovationDeduction({ standardCostJpy: 1_234_567 });

    // 1,234,567 * 10% = 123,456.7 -> 100円未満切り捨てで123,400円
    expect(result.creditJpy.toNumber()).toBe(123_400);
    expect(result.cappedStandardCostJpy.toNumber()).toBe(1_234_567);
    expect(result.notes.some((n) => n.includes("250万円で頭打ち"))).toBe(false);
  });

  it("250万円を超える場合は250万円で頭打ちにし、控除額の上限は25万円になる", () => {
    const result = estimateEarthquakeRenovationDeduction({ standardCostJpy: 3_000_000 });

    expect(result.cappedStandardCostJpy.toNumber()).toBe(2_500_000);
    expect(result.creditJpy.toNumber()).toBe(250_000);
    expect(result.notes.some((n) => n.includes("250万円で頭打ち"))).toBe(true);
  });

  it("ちょうど250万円の場合も25万円になる(頭打ちの注記は出さない)", () => {
    const result = estimateEarthquakeRenovationDeduction({ standardCostJpy: 2_500_000 });

    expect(result.creditJpy.toNumber()).toBe(250_000);
    expect(result.notes.some((n) => n.includes("250万円で頭打ち"))).toBe(false);
  });

  it("0円の場合は控除額も0円になる", () => {
    const result = estimateEarthquakeRenovationDeduction({ standardCostJpy: 0 });

    expect(result.creditJpy.toNumber()).toBe(0);
  });

  it("負の値を入力するとエラーになる", () => {
    expect(() => estimateEarthquakeRenovationDeduction({ standardCostJpy: -1 })).toThrow();
  });
});
