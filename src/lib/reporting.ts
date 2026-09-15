import { prisma } from "./db";
import {
  calculateCryptoPortfolioYear,
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
 * 期首残高(前年繰越)は `CryptoOpeningBalance` / `InvestmentOpeningBalance`
 * に登録されている場合のみ反映される。未登録の銘柄は期首残高0として
 * 計算されるため、取引開始初年度から記録している場合はそのままでよいが、
 * 複数年にまたがる保有は `/import` の「繰越残高」タブで登録するか、
 * 前年分から自動で繰り越す必要がある。
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
    const target = o.isNisa ? investmentNisaOpeningMap : investmentOpeningMap;
    target[o.symbol] = {
      quantity: o.quantity.toString(),
      costBasisJpy: o.costBasisJpy.toString(),
    };
  }

  const crypto = calculateCryptoPortfolioYear(
    cryptoTrades.map((t) => ({
      symbol: t.symbol,
      type: t.type,
      quantity: t.quantity.toString(),
      unitPriceJpy: t.unitPriceJpy.toString(),
      feeJpy: t.feeJpy.toString(),
    })),
    cryptoOpeningMap,
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

  return { crypto, investment };
}
