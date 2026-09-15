import { Decimal } from "decimal.js";
import type { CryptoPortfolioYearResult } from "./crypto/calculator";
import type { InvestmentPortfolioYearResult } from "./investment/calculator";

/**
 * 前年分の計算結果(期末残高)から、翌年分の期首残高として
 * DBに書き込むべきデータを組み立てる。
 *
 * 期末数量が0の銘柄(全て売却・使用済み)は翌年に持ち越す意味が
 * ないため除外する。
 */

export interface OpeningBalanceRow {
  symbol: string;
  quantity: Decimal;
  costBasisJpy: Decimal;
}

export interface InvestmentOpeningBalanceRow extends OpeningBalanceRow {
  isNisa: boolean;
}

export function buildCryptoCarryForward(
  previousYearReport: CryptoPortfolioYearResult,
): OpeningBalanceRow[] {
  return previousYearReport.bySymbol
    .filter((r) => !r.closingQuantity.isZero())
    .map((r) => ({
      symbol: r.symbol,
      quantity: r.closingQuantity,
      costBasisJpy: r.closingCostJpy,
    }));
}

export function buildInvestmentCarryForward(
  previousYearReport: InvestmentPortfolioYearResult,
): InvestmentOpeningBalanceRow[] {
  const rows: InvestmentOpeningBalanceRow[] = [];
  for (const r of previousYearReport.bySymbol) {
    if (!r.closingQuantity.isZero()) {
      rows.push({
        symbol: r.symbol,
        isNisa: false,
        quantity: r.closingQuantity,
        costBasisJpy: r.closingCostJpy,
      });
    }
    if (!r.nisaClosingQuantity.isZero()) {
      rows.push({
        symbol: r.symbol,
        isNisa: true,
        quantity: r.nisaClosingQuantity,
        costBasisJpy: r.nisaClosingCostJpy,
      });
    }
  }
  return rows;
}
