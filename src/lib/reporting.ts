import { prisma } from "./db";
import {
  calculateCryptoPortfolioYearByMethod,
  type CryptoCostMethod,
  type CryptoPortfolioYearResult,
} from "./crypto/calculator";
import {
  calculateCryptoMarginPortfolioYear,
  type CryptoMarginPortfolioYearResult,
} from "./crypto/marginCalculator";
import {
  calculateInvestmentPortfolioYear,
  type InvestmentPortfolioYearResult,
} from "./investment/calculator";
import {
  calculateFuturesPortfolioYear,
  type FuturesPortfolioYearResult,
} from "./investment/futuresIncome";
import {
  calculateLossCarryforward,
  type LossCarryforwardResult,
} from "./investment/lossCarryforward";
import {
  deriveCarryForwardCandidates,
  loadOpeningBalances,
  type CarryForwardCandidate,
} from "./openingBalance";
import {
  calculateNisaLifetimeQuotaUsage,
  calculateNisaQuotaUsage,
  type NisaLifetimeQuotaResult,
  type NisaQuotaUsageResult,
} from "./investment/nisaQuota";
import {
  reconcileAssetBalances,
  type AssetBalanceReconciliationResult,
} from "./moneyforward/assetBalanceReconciliation";

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
  cryptoMargin: CryptoMarginPortfolioYearResult;
  investment: InvestmentPortfolioYearResult;
  futures: FuturesPortfolioYearResult;
  cryptoCostMethod: CryptoCostMethod;
  lossCarryforward: LossCarryforwardResult;
  futuresLossCarryforward: LossCarryforwardResult;
  nisaQuota: NisaQuotaUsageResult;
  nisaLifetimeQuota: NisaLifetimeQuotaResult;
  /**
   * マネーフォワード資産残高との突合結果(機能11参照)。ダッシュボードで
   * 「計上漏れの疑い」を一目で気付けるようにするため、`/import`ページだけでなく
   * ここにも含める。
   */
  assetBalanceReconciliation: AssetBalanceReconciliationResult[];
} | null> {
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (!taxYear) {
    return {
      crypto: calculateCryptoPortfolioYearByMethod("AVERAGE", []),
      cryptoMargin: calculateCryptoMarginPortfolioYear([]),
      investment: calculateInvestmentPortfolioYear([]),
      futures: calculateFuturesPortfolioYear([]),
      cryptoCostMethod: "AVERAGE",
      lossCarryforward: calculateLossCarryforward(year, 0, []),
      futuresLossCarryforward: calculateLossCarryforward(year, 0, []),
      nisaQuota: calculateNisaQuotaUsage([]),
      nisaLifetimeQuota: calculateNisaLifetimeQuotaUsage([], []),
      assetBalanceReconciliation: [],
    };
  }

  const [
    cryptoTrades,
    cryptoMarginTrades,
    investmentTrades,
    futuresTrades,
    openings,
    lossCarryforwardEntries,
    futuresLossCarryforwardEntries,
    nisaLifetimeQuotaEntries,
    assetBalanceSnapshots,
  ] = await Promise.all([
    prisma.cryptoTrade.findMany({ where: { taxYearId: taxYear.id } }),
    prisma.cryptoMarginTrade.findMany({ where: { taxYearId: taxYear.id } }),
    prisma.investmentTrade.findMany({ where: { taxYearId: taxYear.id } }),
    prisma.futuresTrade.findMany({ where: { taxYearId: taxYear.id } }),
    loadOpeningBalances(taxYear.id),
    prisma.investmentLossCarryforward.findMany({
      where: { taxYearId: taxYear.id },
    }),
    prisma.futuresLossCarryforward.findMany({
      where: { taxYearId: taxYear.id },
    }),
    prisma.nisaLifetimeQuota.findMany({
      where: { taxYearId: taxYear.id },
    }),
    prisma.assetBalanceSnapshot.findMany({ where: { taxYearId: taxYear.id } }),
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

  const cryptoMargin = calculateCryptoMarginPortfolioYear(
    cryptoMarginTrades.map((t) => ({
      symbol: t.symbol,
      realizedPnlJpy: t.realizedPnlJpy.toString(),
      feeJpy: t.feeJpy.toString(),
      swapJpy: t.swapJpy.toString(),
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
      isForeign: t.isForeign,
      foreignTaxWithheldJpy: t.foreignTaxWithheldJpy.toString(),
      assetType: t.assetType,
    })),
    openings.investment,
    openings.investmentNisa,
  );

  const lossCarryforward = calculateLossCarryforward(
    year,
    investment.totalRealizedGainJpy,
    lossCarryforwardEntries.map((e) => ({
      originYear: e.originYear,
      remainingAmountJpy: e.remainingAmountJpy.toString(),
    })),
  );

  const futures = calculateFuturesPortfolioYear(
    futuresTrades.map((t) => ({
      symbol: t.symbol,
      realizedPnlJpy: t.realizedPnlJpy.toString(),
      feeJpy: t.feeJpy.toString(),
      swapJpy: t.swapJpy.toString(),
    })),
  );

  const futuresLossCarryforward = calculateLossCarryforward(
    year,
    futures.totalRealizedGainJpy,
    futuresLossCarryforwardEntries.map((e) => ({
      originYear: e.originYear,
      remainingAmountJpy: e.remainingAmountJpy.toString(),
    })),
  );

  const nisaQuotaTrades = investmentTrades.map((t) => ({
    type: t.type,
    isNisa: t.isNisa,
    nisaType: t.nisaType,
    quantity: t.quantity.toString(),
    unitPriceJpy: t.unitPriceJpy.toString(),
  }));

  const nisaQuota = calculateNisaQuotaUsage(nisaQuotaTrades);

  const nisaLifetimeQuota = calculateNisaLifetimeQuotaUsage(
    nisaQuotaTrades,
    nisaLifetimeQuotaEntries.map((e) => ({
      nisaType: e.nisaType,
      openingUsedJpy: e.openingUsedJpy.toString(),
      soldCostBasisJpy: e.soldCostBasisJpy.toString(),
    })),
  );

  const assetBalanceReconciliation = reconcileAssetBalances(
    assetBalanceSnapshots.map((s) => ({
      institution: s.institution,
      balanceJpy: s.balanceJpy.toString(),
    })),
    [
      ...cryptoTrades.map((t) => ({ institution: t.exchange })),
      ...investmentTrades.map((t) => ({ institution: t.broker })),
    ],
  );

  return {
    crypto,
    cryptoMargin,
    investment,
    futures,
    cryptoCostMethod: taxYear.cryptoCostMethod,
    lossCarryforward,
    futuresLossCarryforward,
    nisaQuota,
    nisaLifetimeQuota,
    assetBalanceReconciliation,
  };
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
