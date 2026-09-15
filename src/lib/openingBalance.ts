import { prisma } from "./db";
import type {
  CryptoOpeningBalance,
  CryptoPortfolioYearResult,
} from "./crypto/calculator";
import type {
  InvestmentOpeningBalance,
  InvestmentPortfolioYearResult,
} from "./investment/calculator";

export interface OpeningBalancesByYear {
  crypto: Record<string, CryptoOpeningBalance>;
  investment: Record<string, InvestmentOpeningBalance>;
  investmentNisa: Record<string, InvestmentOpeningBalance>;
}

/**
 * 指定年のTaxYearに登録された期首残高(前年繰越)をDBから読み出し、
 * 計算エンジンの opening 引数の形に整形する。
 */
export async function loadOpeningBalances(
  taxYearId: number,
): Promise<OpeningBalancesByYear> {
  const rows = await prisma.openingBalance.findMany({ where: { taxYearId } });

  const crypto: Record<string, CryptoOpeningBalance> = {};
  const investment: Record<string, InvestmentOpeningBalance> = {};
  const investmentNisa: Record<string, InvestmentOpeningBalance> = {};

  for (const row of rows) {
    const value = {
      quantity: row.quantity.toString(),
      costBasisJpy: row.costBasisJpy.toString(),
    };
    if (row.assetClass === "CRYPTO") {
      crypto[row.symbol] = value;
    } else if (row.isNisa) {
      investmentNisa[row.symbol] = value;
    } else {
      investment[row.symbol] = value;
    }
  }

  return { crypto, investment, investmentNisa };
}

export interface CarryForwardCandidate {
  assetClass: "CRYPTO" | "INVESTMENT";
  symbol: string;
  isNisa: boolean;
  quantity: string;
  costBasisJpy: string;
}

/**
 * ある年の損益計算結果(期末残高)から、翌年の期首残高候補を導出する。
 * DBに依存しない純粋関数。数量が0の銘柄(その年のうちに全量売却済み等)は
 * 繰り越す意味がないため除外する。
 */
export function deriveCarryForwardCandidates(
  crypto: CryptoPortfolioYearResult,
  investment: InvestmentPortfolioYearResult,
): CarryForwardCandidate[] {
  const candidates: CarryForwardCandidate[] = [];

  for (const r of crypto.bySymbol) {
    if (r.closingQuantity.isZero()) continue;
    candidates.push({
      assetClass: "CRYPTO",
      symbol: r.symbol,
      isNisa: false,
      quantity: r.closingQuantity.toString(),
      costBasisJpy: r.closingCostJpy.toString(),
    });
  }

  for (const r of investment.bySymbol) {
    if (!r.closingQuantity.isZero()) {
      candidates.push({
        assetClass: "INVESTMENT",
        symbol: r.symbol,
        isNisa: false,
        quantity: r.closingQuantity.toString(),
        costBasisJpy: r.closingCostJpy.toString(),
      });
    }
    if (!r.nisaClosingQuantity.isZero()) {
      candidates.push({
        assetClass: "INVESTMENT",
        symbol: r.symbol,
        isNisa: true,
        quantity: r.nisaClosingQuantity.toString(),
        costBasisJpy: r.nisaClosingCostJpy.toString(),
      });
    }
  }

  return candidates;
}
