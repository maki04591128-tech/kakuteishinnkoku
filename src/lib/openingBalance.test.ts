import { describe, expect, it } from "vitest";
import { calculateCryptoPortfolioYear } from "./crypto/calculator";
import { calculateInvestmentPortfolioYear } from "./investment/calculator";
import {
  buildCryptoCarryForward,
  buildInvestmentCarryForward,
} from "./openingBalance";

describe("buildCryptoCarryForward", () => {
  it("期末残高が残っている銘柄のみ翌年の期首残高として抽出する", () => {
    const report = calculateCryptoPortfolioYear([
      { symbol: "BTC", type: "BUY", quantity: 1, unitPriceJpy: 5_000_000 },
      { symbol: "BTC", type: "SELL", quantity: 0.4, unitPriceJpy: 6_000_000 },
      { symbol: "ETH", type: "BUY", quantity: 2, unitPriceJpy: 300_000 },
      { symbol: "ETH", type: "SELL", quantity: 2, unitPriceJpy: 350_000 },
    ]);

    const rows = buildCryptoCarryForward(report);

    expect(rows).toHaveLength(1);
    expect(rows[0].symbol).toBe("BTC");
    expect(rows[0].quantity.toNumber()).toBe(0.6);
    expect(rows[0].costBasisJpy.toNumber()).toBe(3_000_000);
  });
});

describe("buildInvestmentCarryForward", () => {
  it("課税口座・NISA口座それぞれ期末残高が残る分だけ抽出する", () => {
    const report = calculateInvestmentPortfolioYear([
      {
        symbol: "7203",
        tradedAt: new Date("2026-01-10"),
        type: "BUY",
        quantity: 100,
        unitPriceJpy: 2000,
      },
      {
        symbol: "7203",
        tradedAt: new Date("2026-06-01"),
        type: "SELL",
        quantity: 40,
        unitPriceJpy: 2500,
      },
      {
        symbol: "9984",
        tradedAt: new Date("2026-01-10"),
        type: "BUY",
        quantity: 10,
        unitPriceJpy: 6000,
        isNisa: true,
      },
      {
        symbol: "9984",
        tradedAt: new Date("2026-06-01"),
        type: "SELL",
        quantity: 10,
        unitPriceJpy: 6500,
        isNisa: true,
      },
      {
        symbol: "1234",
        tradedAt: new Date("2026-02-01"),
        type: "BUY",
        quantity: 5,
        unitPriceJpy: 1000,
        isNisa: true,
      },
    ]);

    const rows = buildInvestmentCarryForward(report);

    expect(rows).toHaveLength(2);
    const stock = rows.find((r) => r.symbol === "7203");
    expect(stock?.isNisa).toBe(false);
    expect(stock?.quantity.toNumber()).toBe(60);
    expect(stock?.costBasisJpy.toNumber()).toBe(120_000);

    const nisaStock = rows.find((r) => r.symbol === "1234");
    expect(nisaStock?.isNisa).toBe(true);
    expect(nisaStock?.quantity.toNumber()).toBe(5);
    expect(nisaStock?.costBasisJpy.toNumber()).toBe(5000);
  });
});
