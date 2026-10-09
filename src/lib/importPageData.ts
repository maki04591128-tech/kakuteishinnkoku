"use server";

// 自宅サーバー版の既定実装(フェーズ7-4・1回目)。スタンドアロン版ビルド
// (`BUILD_TARGET=standalone`)ではnext.config.tsのresolveAlias設定により
// `importPageData.standalone.ts`に差し替えられる。
//
// `src/app/import/page.tsx`は42個のServer Action importを抱える最大のページ
// のため、フェーズ7-1の決定(`"use client"`化・`useSearchParams()`・
// `useEffect`+`startTransition`でのデータ取得)を適用するにはこのファイルの
// ような`<page>PageData`層が必要になる一方、規模が大きいためREADMEの
// 「フェーズ7-4」で決めた通り複数ステップに分割して進める。この1回目は、
// 既存の`page.tsx`(159〜264行目)が`Promise.all`で取得・ソートしていた
// 20種類の生コレクションのデータ取得層のみを切り出す(`page.tsx`自体は
// まだ変更していない)。`buildYearReport`の戻り値(`yearReport`)の変換・
// 突合処理(`reconcileAssetBalances`等、DBに依存しない純粋関数なので
// クライアント側で呼べば十分で、このPageData層には含めない)・`page.tsx`の
// Suspense化は次回以降に続ける。
import { getOrCreateTaxYear } from "@/lib/taxYear";
import { cryptoTradeRepository } from "@/lib/repositories/defaultCryptoTradeRepository";
import { cryptoMarginTradeRepository } from "@/lib/repositories/defaultCryptoMarginTradeRepository";
import { cryptoCreditTradeRepository } from "@/lib/repositories/defaultCryptoCreditTradeRepository";
import { investmentTradeRepository } from "@/lib/repositories/defaultInvestmentTradeRepository";
import { stockMarginTradeRepository } from "@/lib/repositories/defaultStockMarginTradeRepository";
import { futuresTradeRepository } from "@/lib/repositories/defaultFuturesTradeRepository";
import { openingBalanceRepository } from "@/lib/repositories/defaultOpeningBalanceRepository";
import { openingBalanceByInstitutionRepository } from "@/lib/repositories/defaultOpeningBalanceByInstitutionRepository";
import { investmentLossCarryforwardRepository } from "@/lib/repositories/defaultInvestmentLossCarryforwardRepository";
import { futuresLossCarryforwardRepository } from "@/lib/repositories/defaultFuturesLossCarryforwardRepository";
import { foreignTaxCreditCarryforwardRepository } from "@/lib/repositories/defaultForeignTaxCreditCarryforwardRepository";
import { foreignTaxCreditSpareLimitCarryforwardRepository } from "@/lib/repositories/defaultForeignTaxCreditSpareLimitCarryforwardRepository";
import { casualtyLossCarryforwardRepository } from "@/lib/repositories/defaultCasualtyLossCarryforwardRepository";
import { homeSaleLossCarryforwardRepository } from "@/lib/repositories/defaultHomeSaleLossCarryforwardRepository";
import { homeReplacementLossCarryforwardRepository } from "@/lib/repositories/defaultHomeReplacementLossCarryforwardRepository";
import { brokerAnnualReportRepository } from "@/lib/repositories/defaultBrokerAnnualReportRepository";
import { assetBalanceSnapshotRepository } from "@/lib/repositories/defaultAssetBalanceSnapshotRepository";
import { assetSymbolMappingRepository } from "@/lib/repositories/defaultAssetSymbolMappingRepository";
import { marketPriceRepository } from "@/lib/repositories/defaultMarketPriceRepository";
import { nisaLifetimeQuotaRepository } from "@/lib/repositories/defaultNisaLifetimeQuotaRepository";
import type { ImportPageData } from "@/lib/importPageData.types";
import {
  toImportCryptoTradeData,
  toImportCryptoMarginTradeData,
  toImportCryptoCreditTradeData,
  toImportInvestmentTradeData,
  toImportStockMarginTradeData,
  toImportFuturesTradeData,
  toImportOpeningBalanceData,
  toImportOpeningBalanceByInstitutionData,
  toImportOriginYearCarryforwardData,
  toImportBrokerAnnualReportData,
  toImportAssetBalanceImportBatchData,
  toImportAssetSymbolMappingData,
  toImportMarketPriceData,
  toImportNisaLifetimeQuotaData,
} from "@/lib/importPageData.types";

export async function getImportPageData(year: number): Promise<ImportPageData> {
  const taxYear = await getOrCreateTaxYear(year);

  const [
    cryptoTrades,
    cryptoMarginTrades,
    cryptoCreditTrades,
    investmentTrades,
    stockMarginTrades,
    futuresTrades,
    openingBalances,
    openingBalancesByInstitution,
    lossCarryforwards,
    futuresLossCarryforwards,
    foreignTaxCreditCarryforwards,
    foreignTaxCreditSpareLimitCarryforwards,
    casualtyLossCarryforwards,
    homeSaleLossCarryforwards,
    homeReplacementLossCarryforwards,
    brokerAnnualReports,
    assetBalanceImportBatches,
    assetSymbolMappings,
    marketPrices,
    nisaLifetimeQuotas,
  ] = await Promise.all([
    cryptoTradeRepository
      .findByTaxYearId(taxYear.id)
      .then((trades) =>
        [...trades].sort((a, b) => b.tradedAt.getTime() - a.tradedAt.getTime()),
      ),
    cryptoMarginTradeRepository
      .findByTaxYearId(taxYear.id)
      .then((trades) =>
        [...trades].sort((a, b) => b.settledAt.getTime() - a.settledAt.getTime()),
      ),
    cryptoCreditTradeRepository
      .findByTaxYearId(taxYear.id)
      .then((trades) =>
        [...trades].sort((a, b) => b.settledAt.getTime() - a.settledAt.getTime()),
      ),
    investmentTradeRepository
      .findByTaxYearId(taxYear.id)
      .then((trades) =>
        [...trades].sort((a, b) => b.tradedAt.getTime() - a.tradedAt.getTime()),
      ),
    stockMarginTradeRepository
      .findByTaxYearId(taxYear.id)
      .then((trades) =>
        [...trades].sort((a, b) => b.settledAt.getTime() - a.settledAt.getTime()),
      ),
    futuresTradeRepository
      .findByTaxYearId(taxYear.id)
      .then((trades) =>
        [...trades].sort((a, b) => b.settledAt.getTime() - a.settledAt.getTime()),
      ),
    openingBalanceRepository
      .findByTaxYearId(taxYear.id)
      .then((balances) =>
        [...balances].sort(
          (a, b) =>
            a.assetClass.localeCompare(b.assetClass) ||
            a.symbol.localeCompare(b.symbol),
        ),
      ),
    openingBalanceByInstitutionRepository
      .findByTaxYearId(taxYear.id)
      .then((balances) =>
        [...balances].sort(
          (a, b) =>
            a.symbol.localeCompare(b.symbol) ||
            a.institution.localeCompare(b.institution),
        ),
      ),
    investmentLossCarryforwardRepository
      .findByTaxYearId(taxYear.id)
      .then((rows) => [...rows].sort((a, b) => a.originYear - b.originYear)),
    futuresLossCarryforwardRepository
      .findByTaxYearId(taxYear.id)
      .then((rows) => [...rows].sort((a, b) => a.originYear - b.originYear)),
    foreignTaxCreditCarryforwardRepository.findByTaxYearId(taxYear.id),
    foreignTaxCreditSpareLimitCarryforwardRepository.findByTaxYearId(taxYear.id),
    casualtyLossCarryforwardRepository.findByTaxYearId(taxYear.id),
    homeSaleLossCarryforwardRepository.findByTaxYearId(taxYear.id),
    homeReplacementLossCarryforwardRepository.findByTaxYearId(taxYear.id),
    brokerAnnualReportRepository.findByTaxYearId(taxYear.id),
    assetBalanceSnapshotRepository.findImportBatchesWithSnapshots({
      taxYearId: taxYear.id,
      sourceType: "moneyforward_assets",
    }),
    assetSymbolMappingRepository.findMany(),
    marketPriceRepository
      .findMany()
      .then((prices) => [...prices].sort((a, b) => a.symbol.localeCompare(b.symbol))),
    nisaLifetimeQuotaRepository
      .findByTaxYearId(taxYear.id)
      .then((quotas) => [...quotas].sort((a, b) => a.nisaType.localeCompare(b.nisaType))),
  ]);

  return {
    year,
    cryptoCostMethod: taxYear.cryptoCostMethod,
    cryptoTrades: cryptoTrades.map(toImportCryptoTradeData),
    cryptoMarginTrades: cryptoMarginTrades.map(toImportCryptoMarginTradeData),
    cryptoCreditTrades: cryptoCreditTrades.map(toImportCryptoCreditTradeData),
    investmentTrades: investmentTrades.map(toImportInvestmentTradeData),
    stockMarginTrades: stockMarginTrades.map(toImportStockMarginTradeData),
    futuresTrades: futuresTrades.map(toImportFuturesTradeData),
    openingBalances: openingBalances.map(toImportOpeningBalanceData),
    openingBalancesByInstitution: openingBalancesByInstitution.map(
      toImportOpeningBalanceByInstitutionData,
    ),
    lossCarryforwards: lossCarryforwards.map(toImportOriginYearCarryforwardData),
    futuresLossCarryforwards: futuresLossCarryforwards.map(
      toImportOriginYearCarryforwardData,
    ),
    foreignTaxCreditCarryforwards: foreignTaxCreditCarryforwards.map(
      toImportOriginYearCarryforwardData,
    ),
    foreignTaxCreditSpareLimitCarryforwards: foreignTaxCreditSpareLimitCarryforwards.map(
      toImportOriginYearCarryforwardData,
    ),
    casualtyLossCarryforwards: casualtyLossCarryforwards.map(
      toImportOriginYearCarryforwardData,
    ),
    homeSaleLossCarryforwards: homeSaleLossCarryforwards.map(
      toImportOriginYearCarryforwardData,
    ),
    homeReplacementLossCarryforwards: homeReplacementLossCarryforwards.map(
      toImportOriginYearCarryforwardData,
    ),
    brokerAnnualReports: brokerAnnualReports.map(toImportBrokerAnnualReportData),
    assetBalanceImportBatches: assetBalanceImportBatches.map(
      toImportAssetBalanceImportBatchData,
    ),
    assetSymbolMappings: assetSymbolMappings.map(toImportAssetSymbolMappingData),
    marketPrices: marketPrices.map(toImportMarketPriceData),
    nisaLifetimeQuotas: nisaLifetimeQuotas.map(toImportNisaLifetimeQuotaData),
  };
}
