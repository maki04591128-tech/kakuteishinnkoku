import { describe, expect, it } from "vitest";
import { calculateOldNisaExpiryYear, estimateOldNisaExpiryTransfer } from "./oldNisaExpiry";

describe("calculateOldNisaExpiryYear", () => {
  it("一般NISAは投資した年を1年目として5年間(投資年+4年)が非課税期間の最終年になる", () => {
    expect(calculateOldNisaExpiryYear(2019, "GENERAL_OLD")).toBe(2023);
    expect(calculateOldNisaExpiryYear(2021, "GENERAL_OLD")).toBe(2025);
  });

  it("つみたてNISAは投資した年を1年目として20年間(投資年+19年)が非課税期間の最終年になる", () => {
    expect(calculateOldNisaExpiryYear(2018, "TSUMITATE_OLD")).toBe(2037);
    expect(calculateOldNisaExpiryYear(2006, "TSUMITATE_OLD")).toBe(2025);
  });
});

describe("estimateOldNisaExpiryTransfer", () => {
  it("非課税期間中に値上がりした場合、その値上がり益は非課税のまま確定する", () => {
    const result = estimateOldNisaExpiryTransfer({
      holdings: [
        {
          symbol: "TEST-A",
          nisaType: "GENERAL_OLD",
          acquiredYear: 2021,
          quantity: 100,
          originalCostBasisJpy: 1_000_000,
          expiryClosingPriceJpy: 15_000,
        },
      ],
    });

    const h = result.holdings[0];
    expect(h.expiryYear).toBe(2025);
    expect(h.transferYear).toBe(2026);
    expect(h.newCostBasisJpy.toNumber()).toBe(1_500_000);
    expect(h.untaxedGainJpy.toNumber()).toBe(500_000);
    expect(h.isAcquisitionYearInExpectedRange).toBe(true);
    expect(result.totalUntaxedGainJpy.toNumber()).toBe(500_000);
    expect(result.totalDisallowedLossJpy.toNumber()).toBe(0);
  });

  it("非課税期間中に値下がりした場合、その値下がり損は切り捨てられ将来使えない(付け替え後の取得価額は低くなる)", () => {
    const result = estimateOldNisaExpiryTransfer({
      holdings: [
        {
          symbol: "TEST-B",
          nisaType: "TSUMITATE_OLD",
          acquiredYear: 2018,
          quantity: 200,
          originalCostBasisJpy: 2_000_000,
          expiryClosingPriceJpy: 8_000,
        },
      ],
    });

    const h = result.holdings[0];
    expect(h.expiryYear).toBe(2037);
    expect(h.newCostBasisJpy.toNumber()).toBe(1_600_000);
    expect(h.untaxedGainJpy.toNumber()).toBe(-400_000);
    expect(result.totalUntaxedGainJpy.toNumber()).toBe(-400_000);
    // 切り捨てられる含み損は絶対値で集計する
    expect(result.totalDisallowedLossJpy.toNumber()).toBe(400_000);
  });

  it("複数銘柄の場合、合計値は各銘柄の値を単純合算する", () => {
    const result = estimateOldNisaExpiryTransfer({
      holdings: [
        {
          symbol: "GAIN",
          nisaType: "GENERAL_OLD",
          acquiredYear: 2020,
          quantity: 10,
          originalCostBasisJpy: 100_000,
          expiryClosingPriceJpy: 12_000,
        },
        {
          symbol: "LOSS",
          nisaType: "GENERAL_OLD",
          acquiredYear: 2020,
          quantity: 10,
          originalCostBasisJpy: 100_000,
          expiryClosingPriceJpy: 8_000,
        },
      ],
    });

    expect(result.totalOriginalCostBasisJpy.toNumber()).toBe(200_000);
    expect(result.totalNewCostBasisJpy.toNumber()).toBe(200_000);
    expect(result.totalUntaxedGainJpy.toNumber()).toBe(0);
    expect(result.totalDisallowedLossJpy.toNumber()).toBe(20_000);
  });

  it("旧制度の投資可能期間(一般NISA: 2014〜2023年、つみたてNISA: 2018〜2023年)の範囲外でも計算自体は行い、範囲外である旨を示す", () => {
    const result = estimateOldNisaExpiryTransfer({
      holdings: [
        {
          symbol: "OUT_OF_RANGE",
          nisaType: "TSUMITATE_OLD",
          acquiredYear: 2024,
          quantity: 1,
          originalCostBasisJpy: 10_000,
          expiryClosingPriceJpy: 10_000,
        },
      ],
    });

    expect(result.holdings[0].isAcquisitionYearInExpectedRange).toBe(false);
  });

  it("買付数量・取得費・終値が負の場合はエラーになる", () => {
    expect(() =>
      estimateOldNisaExpiryTransfer({
        holdings: [
          {
            symbol: "NEGATIVE",
            nisaType: "GENERAL_OLD",
            acquiredYear: 2020,
            quantity: -1,
            originalCostBasisJpy: 10_000,
            expiryClosingPriceJpy: 10_000,
          },
        ],
      }),
    ).toThrow();
  });
});
