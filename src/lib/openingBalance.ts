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
  /** 一般株式等(非上場株式)分の期首残高(機能54参照。NISA口座は対象外) */
  investmentNonListed: Record<string, InvestmentOpeningBalance>;
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
  const investmentNonListed: Record<string, InvestmentOpeningBalance> = {};

  for (const row of rows) {
    const value = {
      quantity: row.quantity.toString(),
      costBasisJpy: row.costBasisJpy.toString(),
    };
    if (row.assetClass === "CRYPTO") {
      crypto[row.symbol] = value;
    } else if (row.isNisa) {
      investmentNisa[row.symbol] = value;
    } else if (!row.isListed) {
      investmentNonListed[row.symbol] = value;
    } else {
      investment[row.symbol] = value;
    }
  }

  return { crypto, investment, investmentNisa, investmentNonListed };
}

export interface CarryForwardCandidate {
  assetClass: "CRYPTO" | "INVESTMENT";
  symbol: string;
  isNisa: boolean;
  /** 投資(INVESTMENT)のみ有効。上場株式等はtrue、一般株式等(非上場株式)はfalse */
  isListed: boolean;
  quantity: string;
  costBasisJpy: string;
}

/**
 * ある年の損益計算結果(期末残高)から、翌年の期首残高候補を導出する。
 * DBに依存しない純粋関数。数量が0の銘柄(その年のうちに全量売却済み等)は
 * 繰り越す意味がないため除外する。
 *
 * investmentNonListedを省略した場合、一般株式等(非上場株式)分の候補は
 * 生成しない(呼び出し側のテスト等、上場株式等のみを扱う場合の簡略化)。
 */
export function deriveCarryForwardCandidates(
  crypto: CryptoPortfolioYearResult,
  investment: InvestmentPortfolioYearResult,
  investmentNonListed?: InvestmentPortfolioYearResult,
): CarryForwardCandidate[] {
  const candidates: CarryForwardCandidate[] = [];

  for (const r of crypto.bySymbol) {
    if (r.closingQuantity.isZero()) continue;
    candidates.push({
      assetClass: "CRYPTO",
      symbol: r.symbol,
      isNisa: false,
      isListed: true,
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
        isListed: true,
        quantity: r.closingQuantity.toString(),
        costBasisJpy: r.closingCostJpy.toString(),
      });
    }
    if (!r.nisaClosingQuantity.isZero()) {
      candidates.push({
        assetClass: "INVESTMENT",
        symbol: r.symbol,
        isNisa: true,
        isListed: true,
        quantity: r.nisaClosingQuantity.toString(),
        costBasisJpy: r.nisaClosingCostJpy.toString(),
      });
    }
  }

  for (const r of investmentNonListed?.bySymbol ?? []) {
    if (r.closingQuantity.isZero()) continue;
    candidates.push({
      assetClass: "INVESTMENT",
      symbol: r.symbol,
      isNisa: false,
      isListed: false,
      quantity: r.closingQuantity.toString(),
      costBasisJpy: r.closingCostJpy.toString(),
    });
  }

  return candidates;
}
