// スタンドアロン版ビルド用の`@/lib/homePageData`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ7-3継続12回目)。
//
// 呼び出し元(`HomePageContent.tsx`、`"use client"`コンポーネント)から見た
// 関数シグネチャを変えずに、同じ`buildYearReport`・`buildTaxFilingSummary`・
// `listTaxYears`を呼ぶ実装に差し替える。これらはビルドターゲット切り替え機構経由で
// 参照するため、このファイル自体はPrisma/クライアントDBどちらの実装かを意識しない。
import { buildYearReport } from "@/lib/reporting";
import { buildTaxFilingSummary } from "@/lib/etax/summary";
import { listTaxYears } from "@/lib/taxYear";
import type {
  HomeLossCarryforwardData,
  HomePageData,
  HomeReportData,
  HomeSummaryData,
} from "@/lib/homePageData.types";
import type { LossCarryforwardResult } from "@/lib/investment/lossCarryforward";

function toLossCarryforwardData(result: LossCarryforwardResult): HomeLossCarryforwardData {
  return {
    taxableGainJpy: result.taxableGainJpy.toNumber(),
    totalUsedJpy: result.totalUsedJpy.toNumber(),
    newLossJpy: result.newLossJpy.toNumber(),
    expiredByOriginYear: result.expiredByOriginYear.map((e) => ({
      originYear: e.originYear,
      expiredAmountJpy: e.expiredAmountJpy.toNumber(),
    })),
  };
}

export async function getHomePageData(yearParam: number | null): Promise<HomePageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const report = await buildYearReport(year);
  // calculateNisaLifetimeQuotaUsage は byType に TSUMITATE/GROWTH を必ず両方含める
  const nisaLifetimeGrowth = report?.nisaLifetimeQuota.byType.find(
    (t) => t.nisaType === "GROWTH",
  );
  const summary = report
    ? buildTaxFilingSummary(
        year,
        report.crypto,
        report.investment,
        report.lossCarryforward,
        report.cryptoMargin,
        report.futures,
        report.futuresLossCarryforward,
        undefined,
        undefined,
        report.investmentNonListed,
        undefined, // donationTaxCredit
        undefined, // distributionAdjustedForeignTaxCredit
        undefined, // residentTaxAdjustmentDeduction
        undefined, // earthquakeRenovationDeduction
        undefined, // energySavingRenovationDeduction
        undefined, // barrierFreeRenovationDeduction
        undefined, // multiHouseholdRenovationDeduction
        undefined, // durabilityImprovementRenovationDeduction
        undefined, // childRearingRenovationDeduction
        undefined, // certifiedHousingConstructionCredit
        report.stockMargin,
        report.cryptoCredit,
      )
    : null;

  const summaryData: HomeSummaryData | null = summary
    ? {
        cryptoMiscIncomeJpy: summary.cryptoMiscIncomeJpy.toNumber(),
        cryptoSpotIncomeJpy: summary.cryptoSpotIncomeJpy.toNumber(),
        cryptoMarginIncomeJpy: summary.cryptoMarginIncomeJpy.toNumber(),
        cryptoCreditIncomeJpy: summary.cryptoCreditIncomeJpy.toNumber(),
        investmentDividendJpy: summary.investmentDividendJpy.toNumber(),
        investmentLossCarryforward: toLossCarryforwardData(summary.investmentLossCarryforward),
      }
    : null;

  const reportData: HomeReportData | null = report
    ? {
        cryptoCostMethod: report.cryptoCostMethod,
        futuresLossCarryforward: toLossCarryforwardData(report.futuresLossCarryforward),
        investmentNonListedTotalRealizedGainJpy:
          report.investmentNonListed.totalRealizedGainJpy.toNumber(),
        nonListedInvestmentTaxableGainJpy: report.nonListedInvestmentTaxableGainJpy.toNumber(),
        missingInstitutions: report.assetBalanceReconciliation
          .filter((r) => r.status === "MISSING_APP_TRADES")
          .map((r) => r.institution),
        nisaQuota: {
          tsumitateUsedJpy: report.nisaQuota.tsumitateUsedJpy.toNumber(),
          growthUsedJpy: report.nisaQuota.growthUsedJpy.toNumber(),
          unclassifiedBuyJpy: report.nisaQuota.unclassifiedBuyJpy.toNumber(),
          tsumitateLimitJpy: report.nisaQuota.tsumitateLimitJpy.toNumber(),
          tsumitateRemainingJpy: report.nisaQuota.tsumitateRemainingJpy.toNumber(),
          growthLimitJpy: report.nisaQuota.growthLimitJpy.toNumber(),
          growthRemainingJpy: report.nisaQuota.growthRemainingJpy.toNumber(),
        },
        nisaLifetimeQuota: {
          totalOpeningUsedPlusBuyJpy: report.nisaLifetimeQuota.totalOpeningUsedJpy
            .plus(report.nisaLifetimeQuota.totalBuyJpy)
            .toNumber(),
          lifetimeLimitJpy: report.nisaLifetimeQuota.lifetimeLimitJpy.toNumber(),
          totalClosingUsedJpy: report.nisaLifetimeQuota.totalClosingUsedJpy.toNumber(),
          lifetimeRemainingJpy: report.nisaLifetimeQuota.lifetimeLimitJpy
            .minus(report.nisaLifetimeQuota.totalClosingUsedJpy)
            .toNumber(),
          growthLifetimeLimitJpy: report.nisaLifetimeQuota.growthLifetimeLimitJpy.toNumber(),
          growthClosingUsedJpy: (nisaLifetimeGrowth?.closingUsedJpy.toNumber()) ?? 0,
          growthLifetimeRemainingJpy: report.nisaLifetimeQuota.growthLifetimeLimitJpy
            .minus(nisaLifetimeGrowth?.closingUsedJpy ?? 0)
            .toNumber(),
          exceededOverallJpy: report.nisaLifetimeQuota.exceededOverallJpy.toNumber(),
          exceededGrowthJpy: report.nisaLifetimeQuota.exceededGrowthJpy.toNumber(),
        },
        cryptoBySymbol: report.crypto.bySymbol.map((r) => ({
          symbol: r.symbol,
          acquiredQuantity: r.acquiredQuantity.toString(),
          averageUnitCostJpy: r.averageUnitCostJpy.toDecimalPlaces(0).toNumber(),
          disposedQuantity: r.disposedQuantity.toString(),
          realizedGainJpy: r.realizedGainJpy.toNumber(),
        })),
        cryptoMarginBySymbol: report.cryptoMargin.bySymbol.map((r) => ({
          symbol: r.symbol,
          settlementCount: r.settlementCount,
          grossPnlJpy: r.grossPnlJpy.toNumber(),
          feeJpy: r.feeJpy.toNumber(),
          swapJpy: r.swapJpy.toNumber(),
          realizedGainJpy: r.realizedGainJpy.toNumber(),
        })),
        cryptoCreditBySymbol: report.cryptoCredit.bySymbol.map((r) => ({
          symbol: r.symbol,
          settlementCount: r.settlementCount,
          grossPnlJpy: r.grossPnlJpy.toNumber(),
          feeJpy: r.feeJpy.toNumber(),
          interestAdjustmentJpy: r.interestAdjustmentJpy.toNumber(),
          realizedGainJpy: r.realizedGainJpy.toNumber(),
        })),
        investmentBySymbol: report.investment.bySymbol.map((r) => ({
          symbol: r.symbol,
          buyQuantity: r.buyQuantity.toString(),
          sellQuantity: r.sellQuantity.toString(),
          realizedGainJpy: r.realizedGainJpy.toNumber(),
          dividendJpy: r.dividendJpy.toNumber(),
        })),
        investmentNonListedBySymbol: report.investmentNonListed.bySymbol.map((r) => ({
          symbol: r.symbol,
          buyQuantity: r.buyQuantity.toString(),
          sellQuantity: r.sellQuantity.toString(),
          realizedGainJpy: r.realizedGainJpy.toNumber(),
          dividendJpy: r.dividendJpy.toNumber(),
        })),
        futuresBySymbol: report.futures.bySymbol.map((r) => ({
          symbol: r.symbol,
          settlementCount: r.settlementCount,
          grossPnlJpy: r.grossPnlJpy.toNumber(),
          feeJpy: r.feeJpy.toNumber(),
          swapJpy: r.swapJpy.toNumber(),
          realizedGainJpy: r.realizedGainJpy.toNumber(),
        })),
      }
    : null;

  return { year, availableYears, report: reportData, summary: summaryData };
}
