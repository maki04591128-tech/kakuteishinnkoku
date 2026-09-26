import { Decimal } from "decimal.js";
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
  calculateCryptoCreditPortfolioYear,
  type CryptoCreditPortfolioYearResult,
} from "./crypto/creditTrading";
import {
  calculateInvestmentPortfolioYear,
  type InvestmentPortfolioYearResult,
} from "./investment/calculator";
import {
  calculateFuturesPortfolioYear,
  type FuturesPortfolioYearResult,
} from "./investment/futuresIncome";
import {
  calculateStockMarginPortfolioYear,
  type StockMarginPortfolioYearResult,
} from "./investment/marginCalculator";
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
  /**
   * 暗号資産の信用取引の決済損益(機能122参照)。証拠金取引(cryptoMargin)とは
   * 別の取引類型だが、いずれも雑所得の総合課税のため、雑所得(暗号資産)の
   * 合計額には現物取引(crypto)・証拠金取引と合算した額を用いる
   * (`src/lib/etax/summary.ts`のcryptoMiscIncomeJpy参照)。
   */
  cryptoCredit: CryptoCreditPortfolioYearResult;
  investment: InvestmentPortfolioYearResult;
  /**
   * 上場株式等の信用取引の決済損益(機能93参照)。現物取引(investment)とは
   * 別集計だが、課税上は同じ上場株式等の譲渡所得等のプールのため、
   * `lossCarryforward`の計算には investment.totalRealizedGainJpy と合算した
   * 額を渡す。
   */
  stockMargin: StockMarginPortfolioYearResult;
  /**
   * 一般株式等(非上場株式)分の譲渡所得等・配当等(機能54参照)。上場株式等
   * (investment)とは別プールの申告分離課税で損益通算はできず、譲渡損失の
   * 繰越控除(措置法37の12の2)は上場株式等のみの制度のため対象外
   * (nonListedInvestmentTaxableGainJpyで当年限りの切り捨てを反映済み)。
   */
  investmentNonListed: InvestmentPortfolioYearResult;
  /**
   * 一般株式等(非上場株式)分の当年課税対象額(繰越控除制度が無いため、
   * 損失の場合は0円に切り捨てる。黒字の場合はそのまま)。
   */
  nonListedInvestmentTaxableGainJpy: Decimal;
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
      cryptoCredit: calculateCryptoCreditPortfolioYear([]),
      investment: calculateInvestmentPortfolioYear([]),
      stockMargin: calculateStockMarginPortfolioYear([]),
      investmentNonListed: calculateInvestmentPortfolioYear([]),
      nonListedInvestmentTaxableGainJpy: new Decimal(0),
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
    cryptoCreditTrades,
    investmentTrades,
    stockMarginTrades,
    futuresTrades,
    openings,
    lossCarryforwardEntries,
    futuresLossCarryforwardEntries,
    nisaLifetimeQuotaEntries,
    assetBalanceSnapshots,
  ] = await Promise.all([
    prisma.cryptoTrade.findMany({ where: { taxYearId: taxYear.id } }),
    prisma.cryptoMarginTrade.findMany({ where: { taxYearId: taxYear.id } }),
    prisma.cryptoCreditTrade.findMany({ where: { taxYearId: taxYear.id } }),
    prisma.investmentTrade.findMany({ where: { taxYearId: taxYear.id } }),
    prisma.stockMarginTrade.findMany({ where: { taxYearId: taxYear.id } }),
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
      marketValueUnitPriceJpy: t.marketValueUnitPriceJpy?.toString(),
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

  const cryptoCredit = calculateCryptoCreditPortfolioYear(
    cryptoCreditTrades.map((t) => ({
      symbol: t.symbol,
      realizedPnlJpy: t.realizedPnlJpy.toString(),
      feeJpy: t.feeJpy.toString(),
      interestAdjustmentJpy: t.interestAdjustmentJpy.toString(),
    })),
  );

  const toInvestmentTradeInput = (t: (typeof investmentTrades)[number]) => ({
    symbol: t.symbol,
    tradedAt: t.tradedAt,
    type: t.type,
    quantity: t.quantity.toString(),
    unitPriceJpy: t.unitPriceJpy.toString(),
    feeJpy: t.feeJpy.toString(),
    isNisa: t.isNisa,
    isForeign: t.isForeign,
    foreignTaxWithheldJpy: t.foreignTaxWithheldJpy.toString(),
    distributionAdjustedForeignTaxJpy: t.distributionAdjustedForeignTaxJpy.toString(),
    assetType: t.assetType,
    isReit: t.isReit,
    mutualFundHighForeignRatio: t.mutualFundHighForeignRatio,
    mutualFundVeryHighForeignRatio: t.mutualFundVeryHighForeignRatio,
  });

  const investment = calculateInvestmentPortfolioYear(
    investmentTrades.filter((t) => t.isListed).map(toInvestmentTradeInput),
    openings.investment,
    openings.investmentNisa,
  );

  // 一般株式等(非上場株式)は上場株式等とは別プールの申告分離課税(機能54参照)。
  // NISA口座は上場株式等等のみが対象のためNISA分の期首残高は渡さない
  // (登録時にisNisa=trueかつisListed=falseの組み合わせを拒否している)。
  const investmentNonListed = calculateInvestmentPortfolioYear(
    investmentTrades.filter((t) => !t.isListed).map(toInvestmentTradeInput),
    openings.investmentNonListed,
  );
  // 一般株式等の譲渡損失には繰越控除制度(措置法37の12の2)が無いため、
  // 黒字の場合のみそのまま課税対象額とし、赤字の場合は当年限りで切り捨てる。
  const nonListedInvestmentTaxableGainJpy = Decimal.max(
    0,
    investmentNonListed.totalRealizedGainJpy,
  );

  const stockMargin = calculateStockMarginPortfolioYear(
    stockMarginTrades.map((t) => ({
      symbol: t.symbol,
      realizedPnlJpy: t.realizedPnlJpy.toString(),
      feeJpy: t.feeJpy.toString(),
      interestAdjustmentJpy: t.interestAdjustmentJpy.toString(),
    })),
  );

  // 信用取引の決済損益は現物取引と同じ上場株式等の譲渡所得等のプールに合算した上で
  // 繰越控除の計算に渡す(src/lib/investment/marginCalculator.ts参照)。
  const lossCarryforward = calculateLossCarryforward(
    year,
    investment.totalRealizedGainJpy.plus(stockMargin.totalRealizedGainJpy),
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
      ...stockMarginTrades.map((t) => ({ institution: t.broker })),
    ],
  );

  return {
    crypto,
    cryptoMargin,
    cryptoCredit,
    investment,
    stockMargin,
    investmentNonListed,
    nonListedInvestmentTaxableGainJpy,
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
  return deriveCarryForwardCandidates(report.crypto, report.investment, report.investmentNonListed);
}
