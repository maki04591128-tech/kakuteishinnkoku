// `@/lib/homePageData`(自宅サーバー版・`"use server"`)と
// `@/lib/homePageData.standalone`(スタンドアロン版)の両方から
// 共有される戻り値の型。`"use server"`を付けたファイルは非同期関数以外を
// exportできない制約があるため、型だけをこの共有ファイルに切り出す。
// `src/app/page.tsx`(ダッシュボード)が従来Server Component内で直接扱っていた
// `buildYearReport`/`buildTaxFilingSummary`の戻り値(Decimalを含む)は、
// このページデータの境界で全てnumber/stringに変換する(他の移行済みページと同じ方針)。

export interface HomeLossCarryforwardData {
  taxableGainJpy: number;
  totalUsedJpy: number;
  newLossJpy: number;
  expiredByOriginYear: { originYear: number; expiredAmountJpy: number }[];
}

export interface HomeCryptoSymbolRow {
  symbol: string;
  acquiredQuantity: string;
  averageUnitCostJpy: number;
  disposedQuantity: string;
  realizedGainJpy: number;
}

export interface HomeSettlementSymbolRow {
  symbol: string;
  settlementCount: number;
  grossPnlJpy: number;
  feeJpy: number;
  swapJpy: number;
  realizedGainJpy: number;
}

export interface HomeCreditSymbolRow {
  symbol: string;
  settlementCount: number;
  grossPnlJpy: number;
  feeJpy: number;
  interestAdjustmentJpy: number;
  realizedGainJpy: number;
}

export interface HomeInvestmentSymbolRow {
  symbol: string;
  buyQuantity: string;
  sellQuantity: string;
  realizedGainJpy: number;
  dividendJpy: number;
}

export interface HomeSummaryData {
  cryptoMiscIncomeJpy: number;
  cryptoSpotIncomeJpy: number;
  cryptoMarginIncomeJpy: number;
  cryptoCreditIncomeJpy: number;
  investmentDividendJpy: number;
  investmentLossCarryforward: HomeLossCarryforwardData;
}

export interface HomeReportData {
  cryptoCostMethod: string;
  futuresLossCarryforward: HomeLossCarryforwardData;
  investmentNonListedTotalRealizedGainJpy: number;
  nonListedInvestmentTaxableGainJpy: number;
  /** マネーフォワードの資産残高はあるのにアプリに取引明細が無い金融機関名の一覧 */
  missingInstitutions: string[];
  nisaQuota: {
    tsumitateUsedJpy: number;
    growthUsedJpy: number;
    unclassifiedBuyJpy: number;
    tsumitateLimitJpy: number;
    tsumitateRemainingJpy: number;
    growthLimitJpy: number;
    growthRemainingJpy: number;
  };
  nisaLifetimeQuota: {
    totalOpeningUsedPlusBuyJpy: number;
    lifetimeLimitJpy: number;
    totalClosingUsedJpy: number;
    lifetimeRemainingJpy: number;
    growthLifetimeLimitJpy: number;
    growthClosingUsedJpy: number;
    growthLifetimeRemainingJpy: number;
    exceededOverallJpy: number;
    exceededGrowthJpy: number;
  };
  cryptoBySymbol: HomeCryptoSymbolRow[];
  cryptoMarginBySymbol: HomeSettlementSymbolRow[];
  cryptoCreditBySymbol: HomeCreditSymbolRow[];
  investmentBySymbol: HomeInvestmentSymbolRow[];
  investmentNonListedBySymbol: HomeInvestmentSymbolRow[];
  futuresBySymbol: HomeSettlementSymbolRow[];
}

export interface HomePageData {
  year: number;
  availableYears: number[];
  report: HomeReportData | null;
  summary: HomeSummaryData | null;
}
