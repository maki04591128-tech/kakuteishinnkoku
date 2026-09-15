import { prisma } from "./db";
import {
  calculateCryptoPortfolioYear,
  type CryptoPortfolioYearResult,
} from "./crypto/calculator";
import {
  calculateInvestmentPortfolioYear,
  type InvestmentPortfolioYearResult,
} from "./investment/calculator";

/**
 * 指定した課税年度のDB上の取引をすべて読み出し、計算エンジンに渡して
 * 年間損益を算出する。
 *
 * 現状は前年繰越残高(期首残高)の自動引き継ぎには未対応で、
 * その年に登録された取引のみで計算する(取引開始初年度からすべての
 * 取引を記録している前提)。複数年にまたがる保有の繰り越しは
 * 今後のブラッシュアップ課題。
 */
export async function buildYearReport(year: number): Promise<{
  crypto: CryptoPortfolioYearResult;
  investment: InvestmentPortfolioYearResult;
} | null> {
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (!taxYear) {
    return {
      crypto: calculateCryptoPortfolioYear([]),
      investment: calculateInvestmentPortfolioYear([]),
    };
  }

  const [cryptoTrades, investmentTrades] = await Promise.all([
    prisma.cryptoTrade.findMany({ where: { taxYearId: taxYear.id } }),
    prisma.investmentTrade.findMany({ where: { taxYearId: taxYear.id } }),
  ]);

  const crypto = calculateCryptoPortfolioYear(
    cryptoTrades.map((t) => ({
      symbol: t.symbol,
      type: t.type,
      quantity: t.quantity.toString(),
      unitPriceJpy: t.unitPriceJpy.toString(),
      feeJpy: t.feeJpy.toString(),
    })),
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
  );

  return { crypto, investment };
}
