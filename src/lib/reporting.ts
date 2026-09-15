import { prisma } from "./db";
import {
  calculateCryptoPortfolioYearByMethod,
  type CryptoCostMethod,
  type CryptoPortfolioYearResult,
} from "./crypto/calculator";
import {
  calculateInvestmentPortfolioYear,
  type InvestmentPortfolioYearResult,
} from "./investment/calculator";
import {
  deriveCarryForwardCandidates,
  loadOpeningBalances,
  type CarryForwardCandidate,
} from "./openingBalance";

/**
 * 指定した課税年度のDB上の取引をすべて読み出し、計算エンジンに渡して
 * 年間損益を算出する。
 *
 * 前年繰越残高(期首残高)は OpeningBalance テーブルに手入力・繰り越し登録
 * されたものを読み出して計算エンジンの opening 引数に渡す。未登録の銘柄は
 * 期首残高0として扱われる(取引開始初年度からすべての取引を記録している
 * 前提と同じ結果になる)。
 */
export async function buildYearReport(year: number): Promise<{
  crypto: CryptoPortfolioYearResult;
  investment: InvestmentPortfolioYearResult;
  cryptoCostMethod: CryptoCostMethod;
} | null> {
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (!taxYear) {
    return {
      crypto: calculateCryptoPortfolioYearByMethod("AVERAGE", []),
      investment: calculateInvestmentPortfolioYear([]),
      cryptoCostMethod: "AVERAGE",
    };
  }

  const [cryptoTrades, investmentTrades, openings] = await Promise.all([
    prisma.cryptoTrade.findMany({ where: { taxYearId: taxYear.id } }),
    prisma.investmentTrade.findMany({ where: { taxYearId: taxYear.id } }),
    loadOpeningBalances(taxYear.id),
  ]);

  const crypto = calculateCryptoPortfolioYearByMethod(
    taxYear.cryptoCostMethod,
    cryptoTrades.map((t) => ({
      symbol: t.symbol,
      type: t.type,
      quantity: t.quantity.toString(),
      unitPriceJpy: t.unitPriceJpy.toString(),
      feeJpy: t.feeJpy.toString(),
      tradedAt: t.tradedAt,
    })),
    openings.crypto,
  );

  const investment = calculateInvestmentPortfolioYear(
    investmentTrades.map((t) => ({
      symbol: t.symbol,
      tradedAt: t.tradedAt,
      type: t.type,
      quantity: t.quantity.toString(),
      unitPriceJpy: t.unitPriceJpy.toString(),
      feeJpy: t.feeJpy.toString(),
      isNisa: t.isNisa,
    })),
    openings.investment,
    openings.investmentNisa,
  );

  return { crypto, investment, cryptoCostMethod: taxYear.cryptoCostMethod };
}

/**
 * 前年分の取引・期首残高から前年の期末残高を計算し、当年の期首残高候補として返す。
 * 「前年から繰り越す」UIの一括登録に使う。
 */
export async function buildCarryForwardCandidates(
  previousYear: number,
): Promise<CarryForwardCandidate[]> {
  const report = await buildYearReport(previousYear);
  if (!report) return [];
  return deriveCarryForwardCandidates(report.crypto, report.investment);
}
