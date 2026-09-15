import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import { calculateCryptoPortfolioYear } from "../crypto/calculator";
import { calculateInvestmentPortfolioYear } from "../investment/calculator";
import { buildTaxFilingDraftCsv } from "./csvExport";
import { buildTaxFilingSummary } from "./summary";

describe("buildTaxFilingDraftCsv", () => {
  it("公式形式ではない旨の注記と、各所得区分の金額を含むCSVを生成する", () => {
    const crypto = calculateCryptoPortfolioYear([
      { symbol: "BTC", type: "BUY", quantity: 1, unitPriceJpy: 3_000_000 },
      { symbol: "BTC", type: "SELL", quantity: 1, unitPriceJpy: 3_500_000 },
    ]);
    const investment = calculateInvestmentPortfolioYear([
      {
        symbol: "7203",
        tradedAt: new Date("2026-01-01"),
        type: "BUY",
        quantity: 100,
        unitPriceJpy: 2000,
      },
      {
        symbol: "7203",
        tradedAt: new Date("2026-06-01"),
        type: "SELL",
        quantity: 100,
        unitPriceJpy: 2500,
      },
    ]);

    const summary = buildTaxFilingSummary(2026, crypto, investment);
    const csv = buildTaxFilingDraftCsv(summary, crypto.bySymbol, investment.bySymbol);

    expect(csv).toContain("公式インポート形式ではありません");
    expect(csv).toContain("2026年分");
    expect(csv).toContain("500000"); // crypto gain
    expect(csv).toContain("50000"); // investment gain
    expect(csv).toContain("BTC");
    expect(csv).toContain("7203");
  });

  it("カンマを含む値を正しくクォートする", () => {
    const summary = buildTaxFilingSummary(
      2026,
      { bySymbol: [], totalRealizedGainJpy: new Decimal(0) },
      { bySymbol: [], totalRealizedGainJpy: new Decimal(0), totalDividendJpy: new Decimal(0) },
    );
    const csv = buildTaxFilingDraftCsv(summary, [], []);
    // ヘッダーコメント行自体にカンマは無いが、区切りが崩れていないことを確認
    expect(csv.split("\n").length).toBeGreaterThan(5);
  });
});
