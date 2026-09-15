import { prisma } from "./db";
import {
  calculateCryptoPortfolioYear,
  type CryptoCostMethod,
  type CryptoOpeningBalance,
  type CryptoPortfolioYearResult,
} from "./crypto/calculator";
import {
  calculateInvestmentPortfolioYear,
  type InvestmentOpeningBalance,
  type InvestmentPortfolioYearResult,
} from "./investment/calculator";

/**
 * 指定した課税年度のDB上の取引をすべて読み出し、計算エンジンに渡して
 * 年間損益を算出する。
 *
 * 前年繰越残高(期首残高)は CryptoOpeningBalance / InvestmentOpeningBalance
 * テーブルに登録されている場合のみ加味される。取引開始初年度など、
 * 繰越データが無い銘柄は期首残高0として計算する。
 */
export async function buildYearReport(year: number): Promise<{
  crypto: CryptoPortfolioYearResult;
  investment: InvestmentPortfolioYearResult;
  cryptoCostMethod: CryptoCostMethod;
} | null> {
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (!taxYear) {
    return {
      crypto: calculateCryptoPortfolioYear([]),
      investment: calculateInvestmentPortfolioYear([]),
      cryptoCostMethod: "AVERAGE",
    };
  }

  const [cryptoTrades, investmentTrades, cryptoOpenings, investmentOpenings] =
    await Promise.all([
      prisma.cryptoTrade.findMany({ where: { taxYearId: taxYear.id } }),
      prisma.investmentTrade.findMany({ where: { taxYearId: taxYear.id } }),
      prisma.cryptoOpeningBalance.findMany({ where: { taxYearId: taxYear.id } }),
      prisma.investmentOpeningBalance.findMany({
        where: { taxYearId: taxYear.id },
      }),
    ]);

  const cryptoOpeningMap: Record<string, CryptoOpeningBalance> = {};
  for (const o of cryptoOpenings) {
    cryptoOpeningMap[o.symbol] = {
      quantity: o.quantity.toString(),
      costBasisJpy: o.costBasisJpy.toString(),
    };
  }

  const investmentOpeningMap: Record<string, InvestmentOpeningBalance> = {};
  const investmentNisaOpeningMap: Record<string, InvestmentOpeningBalance> = {};
  for (const o of investmentOpenings) {
    const balance: InvestmentOpeningBalance = {
      quantity: o.quantity.toString(),
      costBasisJpy: o.costBasisJpy.toString(),
    };
    if (o.isNisa) {
      investmentNisaOpeningMap[o.symbol] = balance;
    } else {
      investmentOpeningMap[o.symbol] = balance;
    }
  }

  const crypto = calculateCryptoPortfolioYear(
    cryptoTrades.map((t) => ({
      symbol: t.symbol,
      type: t.type,
      quantity: t.quantity.toString(),
      unitPriceJpy: t.unitPriceJpy.toString(),
      feeJpy: t.feeJpy.toString(),
      tradedAt: t.tradedAt,
    })),
    cryptoOpeningMap,
    taxYear.cryptoCostMethod,
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
    investmentOpeningMap,
    investmentNisaOpeningMap,
  );

  return { crypto, investment, cryptoCostMethod: taxYear.cryptoCostMethod };
}
