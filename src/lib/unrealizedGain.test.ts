import { describe, expect, it } from "vitest";
import { calculateUnrealizedGain, summarizeUnrealizedGains } from "./unrealizedGain";

describe("calculateUnrealizedGain", () => {
  it("現在価格が取得単価を上回る場合は含み益になる", () => {
    const result = calculateUnrealizedGain({
      assetType: "CRYPTO",
      symbol: "BTC",
      quantity: 2,
      costBasisJpy: 4_000_000,
      currentPriceJpy: 3_000_000,
    });

    expect(result.averageUnitCostJpy.toString()).toBe("2000000");
    expect(result.marketValueJpy.toString()).toBe("6000000");
    expect(result.unrealizedGainJpy.toString()).toBe("2000000");
    expect(result.isLossHarvestCandidate).toBe(false);
  });

  it("現在価格が取得単価を下回る場合は含み損になり、損出し候補と判定する", () => {
    const result = calculateUnrealizedGain({
      assetType: "INVESTMENT",
      symbol: "1234",
      quantity: 100,
      costBasisJpy: 500_000,
      currentPriceJpy: 4_000,
    });

    expect(result.unrealizedGainJpy.toString()).toBe("-100000");
    expect(result.isLossHarvestCandidate).toBe(true);
  });

  it("NISA口座は含み損があっても損出し候補にならない(損益通算の対象外)", () => {
    const result = calculateUnrealizedGain({
      assetType: "INVESTMENT_NISA",
      symbol: "1234",
      quantity: 100,
      costBasisJpy: 500_000,
      currentPriceJpy: 4_000,
    });

    expect(result.unrealizedGainJpy.toString()).toBe("-100000");
    expect(result.isLossHarvestCandidate).toBe(false);
  });

  it("保有数量が0の場合は平均取得単価・評価額ともに0になる", () => {
    const result = calculateUnrealizedGain({
      assetType: "CRYPTO",
      symbol: "ETH",
      quantity: 0,
      costBasisJpy: 0,
      currentPriceJpy: 300_000,
    });

    expect(result.averageUnitCostJpy.toString()).toBe("0");
    expect(result.marketValueJpy.toString()).toBe("0");
    expect(result.unrealizedGainJpy.toString()).toBe("0");
  });

  it("保有数量・現在価格が負の値の場合はエラーになる", () => {
    expect(() =>
      calculateUnrealizedGain({
        assetType: "CRYPTO",
        symbol: "BTC",
        quantity: -1,
        costBasisJpy: 0,
        currentPriceJpy: 100,
      }),
    ).toThrow();
    expect(() =>
      calculateUnrealizedGain({
        assetType: "CRYPTO",
        symbol: "BTC",
        quantity: 1,
        costBasisJpy: 0,
        currentPriceJpy: -100,
      }),
    ).toThrow();
  });
});

describe("summarizeUnrealizedGains", () => {
  it("資産区分ごと・全体の含み損益合計を集計する", () => {
    const summary = summarizeUnrealizedGains([
      {
        assetType: "CRYPTO",
        symbol: "BTC",
        quantity: 1,
        costBasisJpy: 5_000_000,
        currentPriceJpy: 6_000_000,
      },
      {
        assetType: "INVESTMENT",
        symbol: "1234",
        quantity: 10,
        costBasisJpy: 100_000,
        currentPriceJpy: 8_000,
      },
      {
        assetType: "INVESTMENT_NISA",
        symbol: "5678",
        quantity: 5,
        costBasisJpy: 50_000,
        currentPriceJpy: 12_000,
      },
    ]);

    expect(summary.totalByAssetType.CRYPTO.toString()).toBe("1000000");
    expect(summary.totalByAssetType.INVESTMENT.toString()).toBe("-20000");
    expect(summary.totalByAssetType.INVESTMENT_NISA.toString()).toBe("10000");
    expect(summary.totalMarketValueJpy.toString()).toBe("6140000");
    expect(summary.totalUnrealizedGainJpy.toString()).toBe("990000");
    expect(summary.holdings).toHaveLength(3);
  });

  it("入力が空の場合は0件・合計0を返す", () => {
    const summary = summarizeUnrealizedGains([]);
    expect(summary.holdings).toHaveLength(0);
    expect(summary.totalMarketValueJpy.toString()).toBe("0");
    expect(summary.totalUnrealizedGainJpy.toString()).toBe("0");
  });
});
