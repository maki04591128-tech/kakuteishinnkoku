import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import { calculateCryptoPortfolioYear } from "../crypto/calculator";
import { calculateCryptoMarginPortfolioYear } from "../crypto/marginCalculator";
import { calculateInvestmentPortfolioYear } from "../investment/calculator";
import { calculateFuturesPortfolioYear } from "../investment/futuresIncome";
import { calculateLossCarryforward } from "../investment/lossCarryforward";
import { summarizeIncomeDeductions } from "../incomeDeduction";
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

  it("証拠金取引の決済損益を現物と合算し、内訳を出力する", () => {
    const crypto = calculateCryptoPortfolioYear([
      { symbol: "BTC", type: "BUY", quantity: 1, unitPriceJpy: 3_000_000 },
      { symbol: "BTC", type: "SELL", quantity: 1, unitPriceJpy: 3_500_000 },
    ]);
    const cryptoMargin = calculateCryptoMarginPortfolioYear([
      { symbol: "BTC", realizedPnlJpy: 200_000, feeJpy: 1_000 },
    ]);
    const investment = calculateInvestmentPortfolioYear([]);

    const summary = buildTaxFilingSummary(2026, crypto, investment, undefined, cryptoMargin);
    expect(summary.cryptoMiscIncomeJpy.toNumber()).toBe(500_000 + 199_000);

    const csv = buildTaxFilingDraftCsv(
      summary,
      crypto.bySymbol,
      investment.bySymbol,
      "AVERAGE",
      cryptoMargin.bySymbol,
    );

    expect(csv).toContain("699000"); // 合算後の雑所得
    expect(csv).toContain("199000"); // 証拠金取引分の内訳
    expect(csv).toContain("証拠金(レバレッジ)取引");
  });

  it("先物取引に係る雑所得等(FX・先物)を株式等の譲渡所得とは別区分で出力する", () => {
    const crypto = calculateCryptoPortfolioYear([]);
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
    const futures = calculateFuturesPortfolioYear([
      { symbol: "USD/JPY", realizedPnlJpy: 300_000, feeJpy: 1_000 },
    ]);
    const futuresLossCarryforward = calculateLossCarryforward(
      2026,
      futures.totalRealizedGainJpy,
      [],
    );

    const summary = buildTaxFilingSummary(
      2026,
      crypto,
      investment,
      undefined,
      undefined,
      futures,
      futuresLossCarryforward,
    );
    // 株式等の譲渡所得(50,000円)とFX等の雑所得(299,000円)が混ざらないこと
    expect(summary.investmentCapitalGainJpy.toNumber()).toBe(50_000);
    expect(summary.futuresLossCarryforward.taxableGainJpy.toNumber()).toBe(299_000);

    const csv = buildTaxFilingDraftCsv(
      summary,
      crypto.bySymbol,
      investment.bySymbol,
      "AVERAGE",
      [],
      futures.bySymbol,
    );

    expect(csv).toContain("先物取引に係る雑所得等");
    expect(csv).toContain("299000");
    expect(csv).toContain("USD/JPY");
  });

  it("登録済みの所得控除サマリーを区分・申告書記載箇所とともに出力する", () => {
    const crypto = calculateCryptoPortfolioYear([]);
    const investment = calculateInvestmentPortfolioYear([]);
    const summary = buildTaxFilingSummary(2026, crypto, investment);
    const incomeDeductions = summarizeIncomeDeductions([
      { type: "MEDICAL_EXPENSE", incomeTaxAmountJpy: 80_000, residentTaxAmountJpy: 80_000 },
      { type: "SELF_MEDICATION", incomeTaxAmountJpy: 30_000, residentTaxAmountJpy: 30_000 },
      { type: "SOCIAL_INSURANCE", incomeTaxAmountJpy: 500_000, residentTaxAmountJpy: 500_000 },
    ]);

    const csv = buildTaxFilingDraftCsv(
      summary,
      crypto.bySymbol,
      investment.bySymbol,
      "AVERAGE",
      [],
      [],
      incomeDeductions,
    );

    expect(csv).toContain("■ 所得控除サマリー");
    expect(csv).toContain("医療費控除");
    expect(csv).toContain("社会保険料控除");
    expect(csv).toContain("580000"); // 医療費控除(有利な方)80,000 + 社会保険料控除500,000
    expect(csv).toContain("有利な方");
    expect(csv).toContain("申告書第一表");
  });

  it("登録済みの住宅ローン控除(税額控除)を出力する", () => {
    const crypto = calculateCryptoPortfolioYear([]);
    const investment = calculateInvestmentPortfolioYear([]);
    const summary = buildTaxFilingSummary(
      2026,
      crypto,
      investment,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        nationalTaxCreditJpy: new Decimal(210_000),
        residentTaxCreditJpy: new Decimal(15_000),
      },
    );

    const csv = buildTaxFilingDraftCsv(summary, crypto.bySymbol, investment.bySymbol);

    expect(csv).toContain("■ 税額控除");
    expect(csv).toContain("210000");
    expect(csv).toContain("15000");
    expect(csv).toContain("外国税額控除は/foreign-tax-creditで登録されていない");
  });

  it("登録済みの外国税額控除を住宅ローン控除と合算して出力する", () => {
    const crypto = calculateCryptoPortfolioYear([]);
    const investment = calculateInvestmentPortfolioYear([]);
    const summary = buildTaxFilingSummary(
      2026,
      crypto,
      investment,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        nationalTaxCreditJpy: new Decimal(210_000),
        residentTaxCreditJpy: new Decimal(15_000),
      },
      { totalCreditJpy: new Decimal(45_000) },
      undefined,
      undefined,
      { creditJpy: new Decimal(3_000) },
    );

    const csv = buildTaxFilingDraftCsv(summary, crypto.bySymbol, investment.bySymbol);

    expect(csv).toContain("■ 税額控除");
    expect(csv).toContain("210000");
    expect(csv).toContain("15000");
    expect(csv).toContain("外国税額控除額");
    expect(csv).toContain("45000");
    expect(csv).toContain("分配時調整外国税相当額控除額");
    expect(csv).toContain("3000");
    expect(csv).not.toContain("登録されていないため本CSVには含まれない");
  });

  it("外国税額控除のみ登録されている場合も税額控除欄を出力する", () => {
    const crypto = calculateCryptoPortfolioYear([]);
    const investment = calculateInvestmentPortfolioYear([]);
    const summary = buildTaxFilingSummary(
      2026,
      crypto,
      investment,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { totalCreditJpy: new Decimal(45_000) },
    );

    const csv = buildTaxFilingDraftCsv(summary, crypto.bySymbol, investment.bySymbol);

    expect(csv).toContain("■ 税額控除");
    expect(csv).toContain("外国税額控除額");
    expect(csv).toContain("45000");
    expect(csv).not.toContain("住宅ローン控除");
  });

  it("住宅ローン控除が未登録の場合は税額控除欄を出力しない", () => {
    const crypto = calculateCryptoPortfolioYear([]);
    const investment = calculateInvestmentPortfolioYear([]);
    const summary = buildTaxFilingSummary(2026, crypto, investment);

    const csv = buildTaxFilingDraftCsv(summary, crypto.bySymbol, investment.bySymbol);

    expect(csv).not.toContain("■ 税額控除");
  });

  it("所得控除の登録が無い場合はサマリー欄を出力しない", () => {
    const crypto = calculateCryptoPortfolioYear([]);
    const investment = calculateInvestmentPortfolioYear([]);
    const summary = buildTaxFilingSummary(2026, crypto, investment);

    const csv = buildTaxFilingDraftCsv(summary, crypto.bySymbol, investment.bySymbol);

    expect(csv).not.toContain("■ 所得控除サマリー");
  });

  it("カンマを含む値を正しくクォートする", () => {
    const summary = buildTaxFilingSummary(
      2026,
      { bySymbol: [], totalRealizedGainJpy: new Decimal(0) },
      {
        bySymbol: [],
        totalRealizedGainJpy: new Decimal(0),
        totalDividendJpy: new Decimal(0),
        totalDividendFullCreditJpy: new Decimal(0),
        totalDividendHalfCreditJpy: new Decimal(0),
        totalDividendQuarterCreditJpy: new Decimal(0),
        totalDividendNoCreditJpy: new Decimal(0),
        totalForeignSourceDividendJpy: new Decimal(0),
        totalForeignTaxWithheldJpy: new Decimal(0),
        totalForeignSourceCapitalGainJpy: new Decimal(0),
        totalForeignSourceIncomeJpy: new Decimal(0),
        totalDistributionAdjustedForeignTaxJpy: new Decimal(0),
      },
    );
    const csv = buildTaxFilingDraftCsv(summary, [], []);
    // ヘッダーコメント行自体にカンマは無いが、区切りが崩れていないことを確認
    expect(csv.split("\n").length).toBeGreaterThan(5);
  });

  it("登録済みの住民税の調整控除を税額控除欄に出力する", () => {
    const crypto = calculateCryptoPortfolioYear([]);
    const investment = calculateInvestmentPortfolioYear([]);
    const summary = buildTaxFilingSummary(
      2026,
      crypto,
      investment,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { adjustmentDeductionJpy: new Decimal(2_500) },
    );

    const csv = buildTaxFilingDraftCsv(summary, crypto.bySymbol, investment.bySymbol);

    expect(csv).toContain("■ 税額控除");
    expect(csv).toContain("住民税の調整控除");
    expect(csv).toContain("2500");
  });

  it("住民税の調整控除が未登録の場合、住宅ローン控除等が登録されていれば税額控除欄には含めない", () => {
    const crypto = calculateCryptoPortfolioYear([]);
    const investment = calculateInvestmentPortfolioYear([]);
    const summary = buildTaxFilingSummary(
      2026,
      crypto,
      investment,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        nationalTaxCreditJpy: new Decimal(210_000),
        residentTaxCreditJpy: new Decimal(15_000),
      },
    );

    const csv = buildTaxFilingDraftCsv(summary, crypto.bySymbol, investment.bySymbol);

    expect(csv).toContain("■ 税額控除");
    expect(csv).not.toContain("住民税の調整控除");
  });

  it("一般株式等(非上場株式)の譲渡所得等を上場株式等とは別区分で出力する", () => {
    const crypto = calculateCryptoPortfolioYear([]);
    const investment = calculateInvestmentPortfolioYear([]);
    const investmentNonListed = calculateInvestmentPortfolioYear([
      {
        symbol: "9999",
        tradedAt: new Date("2026-01-01"),
        type: "BUY",
        quantity: 10,
        unitPriceJpy: 100_000,
      },
      {
        symbol: "9999",
        tradedAt: new Date("2026-06-01"),
        type: "SELL",
        quantity: 10,
        unitPriceJpy: 150_000,
      },
    ]);

    const summary = buildTaxFilingSummary(
      2026,
      crypto,
      investment,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      investmentNonListed,
    );
    expect(summary.nonListedInvestmentCapitalGainJpy.toNumber()).toBe(500_000);

    const csv = buildTaxFilingDraftCsv(
      summary,
      crypto.bySymbol,
      investment.bySymbol,
      undefined,
      undefined,
      undefined,
      undefined,
      investmentNonListed.bySymbol,
    );

    expect(csv).toContain("譲渡所得等(一般株式等・非上場株式・申告分離課税)");
    expect(csv).toContain("■ 一般株式等(非上場株式) 銘柄別内訳");
    expect(csv).toContain("500000");
    expect(csv).toContain("9999");
  });
});
