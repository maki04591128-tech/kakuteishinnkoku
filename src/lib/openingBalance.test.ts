import { describe, expect, it } from "vitest";
import { calculateCryptoPortfolioYear } from "./crypto/calculator";
import { calculateInvestmentPortfolioYear } from "./investment/calculator";
import { deriveCarryForwardCandidates } from "./openingBalance";

describe("deriveCarryForwardCandidates", () => {
  it("残数量のある銘柄を翌年の期首残高候補として抽出する", () => {
    const crypto = calculateCryptoPortfolioYear([
      { symbol: "BTC", type: "BUY", quantity: 1, unitPriceJpy: 5_000_000 },
      { symbol: "BTC", type: "SELL", quantity: 0.4, unitPriceJpy: 6_000_000 },
    ]);
    const investment = calculateInvestmentPortfolioYear([
      { symbol: "7203", tradedAt: new Date("2026-01-10"), type: "BUY", quantity: 100, unitPriceJpy: 2000 },
      {
        symbol: "7203",
        tradedAt: new Date("2026-02-01"),
        type: "BUY",
        quantity: 10,
        unitPriceJpy: 2500,
        isNisa: true,
      },
    ]);

    const candidates = deriveCarryForwardCandidates(crypto, investment);

    expect(candidates).toContainEqual({
      assetClass: "CRYPTO",
      symbol: "BTC",
      isNisa: false,
      quantity: "0.6",
      costBasisJpy: "3000000",
    });
    expect(candidates).toContainEqual({
      assetClass: "INVESTMENT",
      symbol: "7203",
      isNisa: false,
      quantity: "100",
      costBasisJpy: "200000",
    });
    expect(candidates).toContainEqual({
      assetClass: "INVESTMENT",
      symbol: "7203",
      isNisa: true,
      quantity: "10",
      costBasisJpy: "25000",
    });
  });

  it("全量売却済み(残数量0)の銘柄は繰り越し候補から除外する", () => {
    const crypto = calculateCryptoPortfolioYear([
      { symbol: "ETH", type: "BUY", quantity: 1, unitPriceJpy: 300_000 },
      { symbol: "ETH", type: "SELL", quantity: 1, unitPriceJpy: 350_000 },
    ]);
    const investment = calculateInvestmentPortfolioYear([]);

    const candidates = deriveCarryForwardCandidates(crypto, investment);

    expect(candidates).toHaveLength(0);
  });
});
