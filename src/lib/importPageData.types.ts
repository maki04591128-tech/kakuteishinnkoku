// `@/lib/importPageData`(自宅サーバー版・`"use server"`)と
// `@/lib/importPageData.standalone`(スタンドアロン版)の両方から共有される
// 戻り値の型と変換関数(フェーズ7-4・1回目)。
//
// `src/app/import/page.tsx`(42個のServer Action importを抱える最大のページ)は
// 他の37ページと異なり、生の取引明細・繰越残高等20種類のコレクションを
// Decimal/Dateを含んだまま画面にそのまま表示するため、フィールドごとの変換
// (`.toNumber()`/`.toString()`/`.toISOString()`)が20モデル分必要になり、他の
// ページのように`<page>PageData.ts`/`.standalone.ts`それぞれに変換処理を
// 個別に書くと同じ変換関数が2箇所に重複してしまう。そのため、このファイル
// (`"use server"`を付けないため通常の関数もexportできる)に変換関数自体も
// 切り出し、`.ts`/`.standalone.ts`の両方から呼ぶ(他の36ページのPageData.types.ts
// は型のみのため、この点のみこのページ特有の構成)。
//
// 変換方針(他の移行済みページと同じ): 金額(末尾Jpy)のDecimalは`.toNumber()`で
// number化、数量(quantity)のDecimalは桁数が多くなりうるため`.toString()`で
// 文字列化、DateはすべてISO 8601文字列(`.toISOString()`)に変換する。
//
// 7-4の2回目で、`yearReport`(`buildYearReport`の戻り値)の変換も同じ理由
// (`.ts`/`.standalone.ts`の両方から同一の変換ロジックを呼ぶ)でこのファイルに
// 追加した。`page.tsx`のSuspense化・`ImportPageContent.tsx`への移行は次回以降。
import type {
  AssetSymbolMapping,
  CryptoCostMethod,
  CryptoTrade,
  CryptoTradeType,
  CryptoMarginTrade,
  CryptoCreditTrade,
  InvestmentTrade,
  InvestmentTradeType,
  InvestmentAssetType,
  InvestmentAccountType,
  InvestmentNisaType,
  StockMarginTrade,
  FuturesTrade,
  OpeningBalance,
  OpeningBalanceAssetClass,
  OpeningBalanceByInstitution,
  BrokerAnnualReport,
  MarketPrice,
  NisaLifetimeQuota,
} from "@prisma/client";
import type { ImportBatchWithSnapshots } from "@/lib/repositories/assetBalanceSnapshotRepository";
import type { buildYearReport } from "@/lib/reporting";
import type { LossCarryforwardResult } from "@/lib/investment/lossCarryforward";

/** `src/app/import/page.tsx`が参照する`buildYearReport`の戻り値(非null)の型 */
type YearReport = NonNullable<Awaited<ReturnType<typeof buildYearReport>>>;

/** 発生年ごとの繰越残高(InvestmentLossCarryforward等7モデルで構造が共通) */
export interface ImportOriginYearCarryforwardData {
  id: number;
  taxYearId: number;
  originYear: number;
  remainingAmountJpy: number;
  createdAt: string;
  updatedAt: string;
}

export interface ImportCryptoTradeData {
  id: number;
  taxYearId: number;
  tradedAt: string;
  symbol: string;
  type: CryptoTradeType;
  quantity: string;
  unitPriceJpy: number;
  marketValueUnitPriceJpy: number | null;
  feeJpy: number;
  exchange: string | null;
  memo: string | null;
  source: string;
  importBatchId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportCryptoMarginTradeData {
  id: number;
  taxYearId: number;
  settledAt: string;
  symbol: string;
  realizedPnlJpy: number;
  feeJpy: number;
  swapJpy: number;
  exchange: string | null;
  memo: string | null;
  source: string;
  importBatchId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportCryptoCreditTradeData {
  id: number;
  taxYearId: number;
  settledAt: string;
  symbol: string;
  realizedPnlJpy: number;
  feeJpy: number;
  interestAdjustmentJpy: number;
  exchange: string | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportInvestmentTradeData {
  id: number;
  taxYearId: number;
  tradedAt: string;
  symbol: string;
  name: string | null;
  assetType: InvestmentAssetType;
  isReit: boolean;
  mutualFundHighForeignRatio: boolean;
  mutualFundVeryHighForeignRatio: boolean;
  isListed: boolean;
  type: InvestmentTradeType;
  quantity: string;
  unitPriceJpy: number;
  feeJpy: number;
  accountType: InvestmentAccountType;
  isNisa: boolean;
  nisaType: InvestmentNisaType | null;
  isForeign: boolean;
  foreignTaxWithheldJpy: number;
  distributionAdjustedForeignTaxJpy: number;
  broker: string | null;
  memo: string | null;
  source: string;
  importBatchId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportStockMarginTradeData {
  id: number;
  taxYearId: number;
  settledAt: string;
  symbol: string;
  realizedPnlJpy: number;
  feeJpy: number;
  interestAdjustmentJpy: number;
  broker: string | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportFuturesTradeData {
  id: number;
  taxYearId: number;
  settledAt: string;
  symbol: string;
  realizedPnlJpy: number;
  feeJpy: number;
  swapJpy: number;
  broker: string | null;
  memo: string | null;
  source: string;
  importBatchId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportOpeningBalanceData {
  id: number;
  taxYearId: number;
  assetClass: OpeningBalanceAssetClass;
  symbol: string;
  isNisa: boolean;
  isListed: boolean;
  quantity: string;
  costBasisJpy: number;
  createdAt: string;
  updatedAt: string;
}

export interface ImportOpeningBalanceByInstitutionData {
  id: number;
  taxYearId: number;
  assetClass: OpeningBalanceAssetClass;
  symbol: string;
  institution: string;
  quantity: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportBrokerAnnualReportData {
  id: number;
  taxYearId: number;
  broker: string;
  accountType: InvestmentAccountType;
  proceedsJpy: number;
  acquisitionCostJpy: number;
  dividendJpy: number;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportAssetBalanceSnapshotData {
  id: number;
  taxYearId: number;
  snapshotDate: string;
  category: string;
  institution: string;
  assetName: string;
  balanceJpy: number;
  quantity: string | null;
  importBatchId: number | null;
  createdAt: string;
}

export interface ImportAssetBalanceImportBatchData {
  id: number;
  taxYearId: number;
  sourceType: string;
  fileName: string;
  importedAt: string;
  rowCount: number;
  assetBalanceSnapshots: ImportAssetBalanceSnapshotData[];
}

export interface ImportAssetSymbolMappingData {
  id: number;
  assetName: string;
  symbol: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportMarketPriceData {
  id: number;
  symbol: string;
  priceJpy: number;
  createdAt: string;
  updatedAt: string;
}

export interface ImportNisaLifetimeQuotaData {
  id: number;
  taxYearId: number;
  nisaType: InvestmentNisaType;
  openingUsedJpy: number;
  soldCostBasisJpy: number;
  createdAt: string;
  updatedAt: string;
}

export interface ImportPageData {
  year: number;
  cryptoCostMethod: CryptoCostMethod;
  cryptoTrades: ImportCryptoTradeData[];
  cryptoMarginTrades: ImportCryptoMarginTradeData[];
  cryptoCreditTrades: ImportCryptoCreditTradeData[];
  investmentTrades: ImportInvestmentTradeData[];
  stockMarginTrades: ImportStockMarginTradeData[];
  futuresTrades: ImportFuturesTradeData[];
  openingBalances: ImportOpeningBalanceData[];
  openingBalancesByInstitution: ImportOpeningBalanceByInstitutionData[];
  lossCarryforwards: ImportOriginYearCarryforwardData[];
  futuresLossCarryforwards: ImportOriginYearCarryforwardData[];
  foreignTaxCreditCarryforwards: ImportOriginYearCarryforwardData[];
  foreignTaxCreditSpareLimitCarryforwards: ImportOriginYearCarryforwardData[];
  casualtyLossCarryforwards: ImportOriginYearCarryforwardData[];
  homeSaleLossCarryforwards: ImportOriginYearCarryforwardData[];
  homeReplacementLossCarryforwards: ImportOriginYearCarryforwardData[];
  brokerAnnualReports: ImportBrokerAnnualReportData[];
  assetBalanceImportBatches: ImportAssetBalanceImportBatchData[];
  assetSymbolMappings: ImportAssetSymbolMappingData[];
  marketPrices: ImportMarketPriceData[];
  nisaLifetimeQuotas: ImportNisaLifetimeQuotaData[];
  yearReport: ImportYearReportData | null;
}

type OriginYearCarryforwardRow = {
  id: number;
  taxYearId: number;
  originYear: number;
  remainingAmountJpy: { toNumber(): number };
  createdAt: Date;
  updatedAt: Date;
};

export function toImportOriginYearCarryforwardData(
  row: OriginYearCarryforwardRow,
): ImportOriginYearCarryforwardData {
  return {
    id: row.id,
    taxYearId: row.taxYearId,
    originYear: row.originYear,
    remainingAmountJpy: row.remainingAmountJpy.toNumber(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toImportCryptoTradeData(row: CryptoTrade): ImportCryptoTradeData {
  return {
    id: row.id,
    taxYearId: row.taxYearId,
    tradedAt: row.tradedAt.toISOString(),
    symbol: row.symbol,
    type: row.type,
    quantity: row.quantity.toString(),
    unitPriceJpy: row.unitPriceJpy.toNumber(),
    marketValueUnitPriceJpy: row.marketValueUnitPriceJpy?.toNumber() ?? null,
    feeJpy: row.feeJpy.toNumber(),
    exchange: row.exchange,
    memo: row.memo,
    source: row.source,
    importBatchId: row.importBatchId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toImportCryptoMarginTradeData(
  row: CryptoMarginTrade,
): ImportCryptoMarginTradeData {
  return {
    id: row.id,
    taxYearId: row.taxYearId,
    settledAt: row.settledAt.toISOString(),
    symbol: row.symbol,
    realizedPnlJpy: row.realizedPnlJpy.toNumber(),
    feeJpy: row.feeJpy.toNumber(),
    swapJpy: row.swapJpy.toNumber(),
    exchange: row.exchange,
    memo: row.memo,
    source: row.source,
    importBatchId: row.importBatchId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toImportCryptoCreditTradeData(
  row: CryptoCreditTrade,
): ImportCryptoCreditTradeData {
  return {
    id: row.id,
    taxYearId: row.taxYearId,
    settledAt: row.settledAt.toISOString(),
    symbol: row.symbol,
    realizedPnlJpy: row.realizedPnlJpy.toNumber(),
    feeJpy: row.feeJpy.toNumber(),
    interestAdjustmentJpy: row.interestAdjustmentJpy.toNumber(),
    exchange: row.exchange,
    memo: row.memo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toImportInvestmentTradeData(
  row: InvestmentTrade,
): ImportInvestmentTradeData {
  return {
    id: row.id,
    taxYearId: row.taxYearId,
    tradedAt: row.tradedAt.toISOString(),
    symbol: row.symbol,
    name: row.name,
    assetType: row.assetType,
    isReit: row.isReit,
    mutualFundHighForeignRatio: row.mutualFundHighForeignRatio,
    mutualFundVeryHighForeignRatio: row.mutualFundVeryHighForeignRatio,
    isListed: row.isListed,
    type: row.type,
    quantity: row.quantity.toString(),
    unitPriceJpy: row.unitPriceJpy.toNumber(),
    feeJpy: row.feeJpy.toNumber(),
    accountType: row.accountType,
    isNisa: row.isNisa,
    nisaType: row.nisaType,
    isForeign: row.isForeign,
    foreignTaxWithheldJpy: row.foreignTaxWithheldJpy.toNumber(),
    distributionAdjustedForeignTaxJpy: row.distributionAdjustedForeignTaxJpy.toNumber(),
    broker: row.broker,
    memo: row.memo,
    source: row.source,
    importBatchId: row.importBatchId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toImportStockMarginTradeData(
  row: StockMarginTrade,
): ImportStockMarginTradeData {
  return {
    id: row.id,
    taxYearId: row.taxYearId,
    settledAt: row.settledAt.toISOString(),
    symbol: row.symbol,
    realizedPnlJpy: row.realizedPnlJpy.toNumber(),
    feeJpy: row.feeJpy.toNumber(),
    interestAdjustmentJpy: row.interestAdjustmentJpy.toNumber(),
    broker: row.broker,
    memo: row.memo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toImportFuturesTradeData(row: FuturesTrade): ImportFuturesTradeData {
  return {
    id: row.id,
    taxYearId: row.taxYearId,
    settledAt: row.settledAt.toISOString(),
    symbol: row.symbol,
    realizedPnlJpy: row.realizedPnlJpy.toNumber(),
    feeJpy: row.feeJpy.toNumber(),
    swapJpy: row.swapJpy.toNumber(),
    broker: row.broker,
    memo: row.memo,
    source: row.source,
    importBatchId: row.importBatchId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toImportOpeningBalanceData(row: OpeningBalance): ImportOpeningBalanceData {
  return {
    id: row.id,
    taxYearId: row.taxYearId,
    assetClass: row.assetClass,
    symbol: row.symbol,
    isNisa: row.isNisa,
    isListed: row.isListed,
    quantity: row.quantity.toString(),
    costBasisJpy: row.costBasisJpy.toNumber(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toImportOpeningBalanceByInstitutionData(
  row: OpeningBalanceByInstitution,
): ImportOpeningBalanceByInstitutionData {
  return {
    id: row.id,
    taxYearId: row.taxYearId,
    assetClass: row.assetClass,
    symbol: row.symbol,
    institution: row.institution,
    quantity: row.quantity.toString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toImportBrokerAnnualReportData(
  row: BrokerAnnualReport,
): ImportBrokerAnnualReportData {
  return {
    id: row.id,
    taxYearId: row.taxYearId,
    broker: row.broker,
    accountType: row.accountType,
    proceedsJpy: row.proceedsJpy.toNumber(),
    acquisitionCostJpy: row.acquisitionCostJpy.toNumber(),
    dividendJpy: row.dividendJpy.toNumber(),
    memo: row.memo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toImportAssetBalanceImportBatchData(
  row: ImportBatchWithSnapshots,
): ImportAssetBalanceImportBatchData {
  return {
    id: row.id,
    taxYearId: row.taxYearId,
    sourceType: row.sourceType,
    fileName: row.fileName,
    importedAt: row.importedAt.toISOString(),
    rowCount: row.rowCount,
    assetBalanceSnapshots: row.assetBalanceSnapshots.map((s) => ({
      id: s.id,
      taxYearId: s.taxYearId,
      snapshotDate: s.snapshotDate.toISOString(),
      category: s.category,
      institution: s.institution,
      assetName: s.assetName,
      balanceJpy: s.balanceJpy.toNumber(),
      quantity: s.quantity?.toString() ?? null,
      importBatchId: s.importBatchId,
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

export function toImportAssetSymbolMappingData(
  row: AssetSymbolMapping,
): ImportAssetSymbolMappingData {
  return {
    id: row.id,
    assetName: row.assetName,
    symbol: row.symbol,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toImportMarketPriceData(row: MarketPrice): ImportMarketPriceData {
  return {
    id: row.id,
    symbol: row.symbol,
    priceJpy: row.priceJpy.toNumber(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toImportNisaLifetimeQuotaData(
  row: NisaLifetimeQuota,
): ImportNisaLifetimeQuotaData {
  return {
    id: row.id,
    taxYearId: row.taxYearId,
    nisaType: row.nisaType,
    openingUsedJpy: row.openingUsedJpy.toNumber(),
    soldCostBasisJpy: row.soldCostBasisJpy.toNumber(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * 譲渡損失の繰越控除(`lossCarryforward`/`futuresLossCarryforward`)の表示に
 * 必要な部分のみを変換する(`src/lib/homePageData.ts`の`toLossCarryforwardData`と
 * 同じ変換方針だが、importページは`grossRealizedGainJpy`も表示するため含める)。
 */
export interface ImportLossCarryforwardData {
  grossRealizedGainJpy: number;
  totalUsedJpy: number;
  taxableGainJpy: number;
  newLossJpy: number;
  expiredByOriginYear: { originYear: number; expiredAmountJpy: number }[];
}

export function toImportLossCarryforwardData(
  result: LossCarryforwardResult,
): ImportLossCarryforwardData {
  return {
    grossRealizedGainJpy: result.grossRealizedGainJpy.toNumber(),
    totalUsedJpy: result.totalUsedJpy.toNumber(),
    taxableGainJpy: result.taxableGainJpy.toNumber(),
    newLossJpy: result.newLossJpy.toNumber(),
    expiredByOriginYear: result.expiredByOriginYear.map((e) => ({
      originYear: e.originYear,
      expiredAmountJpy: e.expiredAmountJpy.toNumber(),
    })),
  };
}

/**
 * `buildYearReport`の戻り値のうち、`page.tsx`が実際に参照している部分のみを
 * 変換する(`assetBalanceReconciliation`等、`page.tsx`が使っていないフィールドは
 * 含めない)。
 */
export interface ImportYearReportData {
  cryptoMarginTotalRealizedGainJpy: number;
  cryptoCreditTotalRealizedGainJpy: number;
  stockMarginTotalRealizedGainJpy: number;
  futuresTotalRealizedGainJpy: number;
  lossCarryforward: ImportLossCarryforwardData;
  futuresLossCarryforward: ImportLossCarryforwardData;
  nisaLifetimeQuota: {
    totalClosingUsedJpy: number;
    lifetimeLimitJpy: number;
    exceededOverallJpy: number;
    exceededGrowthJpy: number;
  };
}

export function toImportYearReportData(report: YearReport): ImportYearReportData {
  return {
    cryptoMarginTotalRealizedGainJpy: report.cryptoMargin.totalRealizedGainJpy.toNumber(),
    cryptoCreditTotalRealizedGainJpy: report.cryptoCredit.totalRealizedGainJpy.toNumber(),
    stockMarginTotalRealizedGainJpy: report.stockMargin.totalRealizedGainJpy.toNumber(),
    futuresTotalRealizedGainJpy: report.futures.totalRealizedGainJpy.toNumber(),
    lossCarryforward: toImportLossCarryforwardData(report.lossCarryforward),
    futuresLossCarryforward: toImportLossCarryforwardData(report.futuresLossCarryforward),
    nisaLifetimeQuota: {
      totalClosingUsedJpy: report.nisaLifetimeQuota.totalClosingUsedJpy.toNumber(),
      lifetimeLimitJpy: report.nisaLifetimeQuota.lifetimeLimitJpy.toNumber(),
      exceededOverallJpy: report.nisaLifetimeQuota.exceededOverallJpy.toNumber(),
      exceededGrowthJpy: report.nisaLifetimeQuota.exceededGrowthJpy.toNumber(),
    },
  };
}
