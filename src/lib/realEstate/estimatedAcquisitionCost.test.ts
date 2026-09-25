import { describe, expect, it } from "vitest";
import {
  ESTIMATED_ACQUISITION_COST_RATE,
  calculateEstimatedAcquisitionCostJpy,
  resolveAcquisitionCostJpy,
} from "./estimatedAcquisitionCost";

describe("calculateEstimatedAcquisitionCostJpy", () => {
  it("譲渡価額の5%相当額を計算する", () => {
    expect(calculateEstimatedAcquisitionCostJpy(30_000_000).toNumber()).toBe(1_500_000);
  });

  it("係数は5%", () => {
    expect(ESTIMATED_ACQUISITION_COST_RATE).toBe(0.05);
  });

  it("負の譲渡価額は拒否する", () => {
    expect(() => calculateEstimatedAcquisitionCostJpy(-1)).toThrow();
  });
});

describe("resolveAcquisitionCostJpy", () => {
  it("概算取得費の特例を希望しない場合は実際の取得費をそのまま採用する", () => {
    const result = resolveAcquisitionCostJpy({
      actualAcquisitionCostJpy: 500_000,
      transferPriceJpy: 30_000_000,
      useEstimated: false,
    });

    expect(result.acquisitionCostJpy.toNumber()).toBe(500_000);
    expect(result.estimatedAcquisitionCostJpy.toNumber()).toBe(1_500_000);
    expect(result.estimatedApplied).toBe(false);
    expect(result.notes).toHaveLength(0);
  });

  it("取得費が不明(0円)で概算取得費を希望する場合は5%相当額を採用する", () => {
    const result = resolveAcquisitionCostJpy({
      actualAcquisitionCostJpy: 0,
      transferPriceJpy: 30_000_000,
      useEstimated: true,
    });

    expect(result.acquisitionCostJpy.toNumber()).toBe(1_500_000);
    expect(result.estimatedApplied).toBe(true);
    expect(result.notes.some((n) => n.includes("概算取得費の特例"))).toBe(true);
  });

  it("実際の取得費が5%相当額を下回る場合、概算取得費を希望すれば5%相当額を採用する", () => {
    const result = resolveAcquisitionCostJpy({
      actualAcquisitionCostJpy: 1_000_000,
      transferPriceJpy: 30_000_000,
      useEstimated: true,
    });

    expect(result.acquisitionCostJpy.toNumber()).toBe(1_500_000);
    expect(result.estimatedApplied).toBe(true);
  });

  it("実際の取得費が5%相当額以上の場合、概算取得費を希望しても実際の取得費のまま(有利な方を自動選択)", () => {
    const result = resolveAcquisitionCostJpy({
      actualAcquisitionCostJpy: 10_000_000,
      transferPriceJpy: 30_000_000,
      useEstimated: true,
    });

    expect(result.acquisitionCostJpy.toNumber()).toBe(10_000_000);
    expect(result.estimatedApplied).toBe(false);
    expect(result.notes.some((n) => n.includes("実際の取得費をそのまま採用"))).toBe(true);
  });

  it("実際の取得費がちょうど5%相当額の場合は概算取得費を適用したことにはしない", () => {
    const result = resolveAcquisitionCostJpy({
      actualAcquisitionCostJpy: 1_500_000,
      transferPriceJpy: 30_000_000,
      useEstimated: true,
    });

    expect(result.acquisitionCostJpy.toNumber()).toBe(1_500_000);
    expect(result.estimatedApplied).toBe(false);
  });

  it("負の取得費は拒否する", () => {
    expect(() =>
      resolveAcquisitionCostJpy({
        actualAcquisitionCostJpy: -1,
        transferPriceJpy: 30_000_000,
        useEstimated: false,
      }),
    ).toThrow();
  });
});
