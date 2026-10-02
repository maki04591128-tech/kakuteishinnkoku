"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Decimal } from "decimal.js";
import { createPrismaTaxYearRepository } from "@/lib/repositories/taxYearRepository";
import { createPrismaCryptoTradeRepository } from "@/lib/repositories/cryptoTradeRepository";
import { createPrismaInvestmentTradeRepository } from "@/lib/repositories/investmentTradeRepository";
import { createPrismaCryptoMarginTradeRepository } from "@/lib/repositories/cryptoMarginTradeRepository";
import { createPrismaCryptoCreditTradeRepository } from "@/lib/repositories/cryptoCreditTradeRepository";
import { createPrismaStockMarginTradeRepository } from "@/lib/repositories/stockMarginTradeRepository";
import { createPrismaFuturesTradeRepository } from "@/lib/repositories/futuresTradeRepository";
import { createPrismaFuturesLossCarryforwardRepository } from "@/lib/repositories/futuresLossCarryforwardRepository";
import { createPrismaInvestmentLossCarryforwardRepository } from "@/lib/repositories/investmentLossCarryforwardRepository";
import { createPrismaOpeningBalanceRepository } from "@/lib/repositories/openingBalanceRepository";
import { createPrismaOpeningBalanceByInstitutionRepository } from "@/lib/repositories/openingBalanceByInstitutionRepository";
import { createPrismaBrokerAnnualReportRepository } from "@/lib/repositories/brokerAnnualReportRepository";
import { createPrismaNisaLifetimeQuotaRepository } from "@/lib/repositories/nisaLifetimeQuotaRepository";
import { createPrismaAssetSymbolMappingRepository } from "@/lib/repositories/assetSymbolMappingRepository";
import { createPrismaMarketPriceRepository } from "@/lib/repositories/marketPriceRepository";
import { createPrismaForeignTaxCreditCarryforwardRepository } from "@/lib/repositories/foreignTaxCreditCarryforwardRepository";
import { createPrismaForeignTaxCreditSpareLimitCarryforwardRepository } from "@/lib/repositories/foreignTaxCreditSpareLimitCarryforwardRepository";
import { createPrismaCasualtyLossCarryforwardRepository } from "@/lib/repositories/casualtyLossCarryforwardRepository";
import { createPrismaHomeSaleLossCarryforwardRepository } from "@/lib/repositories/homeSaleLossCarryforwardRepository";
import { createPrismaHomeReplacementLossCarryforwardRepository } from "@/lib/repositories/homeReplacementLossCarryforwardRepository";
import { createPrismaAngelTaxLossCarryforwardRepository } from "@/lib/repositories/angelTaxLossCarryforwardRepository";
import { createPrismaForeignTaxCreditRecordRepository } from "@/lib/repositories/foreignTaxCreditRecordRepository";
import { createPrismaDonationTaxCreditRecordRepository } from "@/lib/repositories/donationTaxCreditRecordRepository";
import { createPrismaDistributionAdjustedForeignTaxCreditRecordRepository } from "@/lib/repositories/distributionAdjustedForeignTaxCreditRecordRepository";
import { createPrismaEarthquakeRenovationDeductionRecordRepository } from "@/lib/repositories/earthquakeRenovationDeductionRecordRepository";
import { createPrismaEnergySavingRenovationDeductionRecordRepository } from "@/lib/repositories/energySavingRenovationDeductionRecordRepository";
import { createPrismaBarrierFreeRenovationDeductionRecordRepository } from "@/lib/repositories/barrierFreeRenovationDeductionRecordRepository";
import { createPrismaMultiHouseholdRenovationDeductionRecordRepository } from "@/lib/repositories/multiHouseholdRenovationDeductionRecordRepository";
import { createPrismaDurabilityImprovementRenovationDeductionRecordRepository } from "@/lib/repositories/durabilityImprovementRenovationDeductionRecordRepository";
import { createPrismaChildRearingRenovationDeductionRecordRepository } from "@/lib/repositories/childRearingRenovationDeductionRecordRepository";
import { createPrismaCertifiedHousingConstructionCreditRecordRepository } from "@/lib/repositories/certifiedHousingConstructionCreditRecordRepository";
import { createPrismaCertifiedHousingConstructionCreditCarryforwardRepository } from "@/lib/repositories/certifiedHousingConstructionCreditCarryforwardRepository";
import { createPrismaIncomeDeductionRepository } from "@/lib/repositories/incomeDeductionRepository";
import { createPrismaMortgageDeductionRecordRepository } from "@/lib/repositories/mortgageDeductionRecordRepository";
import { createPrismaResidentTaxAdjustmentDeductionRecordRepository } from "@/lib/repositories/residentTaxAdjustmentDeductionRecordRepository";
import { createPrismaEmploymentIncomeRecordRepository } from "@/lib/repositories/employmentIncomeRecordRepository";
import { createPrismaCashflowEntryRepository } from "@/lib/repositories/cashflowEntryRepository";
import { createPrismaAssetBalanceSnapshotRepository } from "@/lib/repositories/assetBalanceSnapshotRepository";
import { decodeCsvFile } from "@/lib/csv";
import { parseMoneyForwardCashflowCsv } from "@/lib/moneyforward/parseCashflow";
import {
  parseExchangeCsv,
  type ExchangeCsvMapping,
  type ExchangeCsvPreset,
} from "@/lib/crypto/exchangeCsv";
import { parseCryptoMarginCsv, type MarginCsvMapping } from "@/lib/crypto/marginCsv";
import { parseFuturesCsv, type FuturesCsvMapping } from "@/lib/investment/futuresCsv";
import {
  parseMoneyForwardAssetBalanceCsv,
  type AssetBalanceCsvMapping,
} from "@/lib/moneyforward/parseAssetBalance";
import {
  parseBrokerAnnualReportCsv,
  type AnnualReportCsvMapping,
} from "@/lib/investment/annualReportCsv";
import { getOrCreateTaxYear } from "@/lib/taxYear";
import { buildCarryForwardCandidates, buildYearReport } from "@/lib/reporting";
import { isIncomeDeductionType } from "@/lib/incomeDeduction";
import { deriveNisaLifetimeCarryForwardCandidates } from "@/lib/investment/nisaQuota";
import { setCryptoCostMethodCore } from "@/lib/actions/setCryptoCostMethod";
import {
  setAssetSymbolMappingCore,
  deleteAssetSymbolMappingCore,
} from "@/lib/actions/assetSymbolMapping";
import { setMarketPriceCore, deleteMarketPriceCore } from "@/lib/actions/marketPrice";
import {
  setAngelTaxLossCarryforwardCore,
  deleteAngelTaxLossCarryforwardCore,
} from "@/lib/actions/angelTaxLossCarryforward";
import {
  setFuturesLossCarryforwardCore,
  deleteFuturesLossCarryforwardCore,
} from "@/lib/actions/futuresLossCarryforward";
import {
  setCasualtyLossCarryforwardCore,
  deleteCasualtyLossCarryforwardCore,
} from "@/lib/actions/casualtyLossCarryforward";
import {
  setHomeSaleLossCarryforwardCore,
  deleteHomeSaleLossCarryforwardCore,
} from "@/lib/actions/homeSaleLossCarryforward";
import {
  setHomeReplacementLossCarryforwardCore,
  deleteHomeReplacementLossCarryforwardCore,
} from "@/lib/actions/homeReplacementLossCarryforward";
import {
  setForeignTaxCreditCarryforwardCore,
  deleteForeignTaxCreditCarryforwardCore,
} from "@/lib/actions/foreignTaxCreditCarryforward";
import {
  setForeignTaxCreditSpareLimitCarryforwardCore,
  deleteForeignTaxCreditSpareLimitCarryforwardCore,
} from "@/lib/actions/foreignTaxCreditSpareLimitCarryforward";
import {
  saveEarthquakeRenovationDeductionRecordCore,
  deleteEarthquakeRenovationDeductionRecordCore,
} from "@/lib/actions/earthquakeRenovationDeductionRecord";
import {
  saveEnergySavingRenovationDeductionRecordCore,
  deleteEnergySavingRenovationDeductionRecordCore,
} from "@/lib/actions/energySavingRenovationDeductionRecord";
import {
  saveBarrierFreeRenovationDeductionRecordCore,
  deleteBarrierFreeRenovationDeductionRecordCore,
} from "@/lib/actions/barrierFreeRenovationDeductionRecord";
import {
  saveMultiHouseholdRenovationDeductionRecordCore,
  deleteMultiHouseholdRenovationDeductionRecordCore,
} from "@/lib/actions/multiHouseholdRenovationDeductionRecord";

function requireString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} は必須です`);
  }
  return value;
}

function optionalString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string" || value.trim() === "") return null;
  return value;
}

function hasStringValue(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "";
}

const EXCHANGE_LABELS: Record<Exclude<ExchangeCsvPreset, "other">, string> = {
  bitflyer: "bitFlyer",
  coincheck: "Coincheck",
  gmo: "GMOコイン",
  bitbank: "bitbank",
};

function isKnownExchangeCsvPreset(
  preset: ExchangeCsvPreset,
): preset is Exclude<ExchangeCsvPreset, "other"> {
  return preset in EXCHANGE_LABELS;
}

const taxYearRepository = createPrismaTaxYearRepository();
const cryptoTradeRepository = createPrismaCryptoTradeRepository();
const investmentTradeRepository = createPrismaInvestmentTradeRepository();
const cryptoMarginTradeRepository = createPrismaCryptoMarginTradeRepository();
const cryptoCreditTradeRepository = createPrismaCryptoCreditTradeRepository();
const stockMarginTradeRepository = createPrismaStockMarginTradeRepository();
const futuresTradeRepository = createPrismaFuturesTradeRepository();
const futuresLossCarryforwardRepository = createPrismaFuturesLossCarryforwardRepository();
const investmentLossCarryforwardRepository =
  createPrismaInvestmentLossCarryforwardRepository();
const brokerAnnualReportRepository = createPrismaBrokerAnnualReportRepository();
const openingBalanceRepository = createPrismaOpeningBalanceRepository();
const openingBalanceByInstitutionRepository =
  createPrismaOpeningBalanceByInstitutionRepository();
const nisaLifetimeQuotaRepository = createPrismaNisaLifetimeQuotaRepository();
const assetSymbolMappingRepository = createPrismaAssetSymbolMappingRepository();
const marketPriceRepository = createPrismaMarketPriceRepository();
const foreignTaxCreditCarryforwardRepository =
  createPrismaForeignTaxCreditCarryforwardRepository();
const foreignTaxCreditSpareLimitCarryforwardRepository =
  createPrismaForeignTaxCreditSpareLimitCarryforwardRepository();
const casualtyLossCarryforwardRepository = createPrismaCasualtyLossCarryforwardRepository();
const homeSaleLossCarryforwardRepository = createPrismaHomeSaleLossCarryforwardRepository();
const homeReplacementLossCarryforwardRepository =
  createPrismaHomeReplacementLossCarryforwardRepository();
const angelTaxLossCarryforwardRepository = createPrismaAngelTaxLossCarryforwardRepository();
const foreignTaxCreditRecordRepository = createPrismaForeignTaxCreditRecordRepository();
const donationTaxCreditRecordRepository = createPrismaDonationTaxCreditRecordRepository();
const distributionAdjustedForeignTaxCreditRecordRepository =
  createPrismaDistributionAdjustedForeignTaxCreditRecordRepository();
const earthquakeRenovationDeductionRecordRepository =
  createPrismaEarthquakeRenovationDeductionRecordRepository();
const energySavingRenovationDeductionRecordRepository =
  createPrismaEnergySavingRenovationDeductionRecordRepository();
const barrierFreeRenovationDeductionRecordRepository =
  createPrismaBarrierFreeRenovationDeductionRecordRepository();
const multiHouseholdRenovationDeductionRecordRepository =
  createPrismaMultiHouseholdRenovationDeductionRecordRepository();
const durabilityImprovementRenovationDeductionRecordRepository =
  createPrismaDurabilityImprovementRenovationDeductionRecordRepository();
const childRearingRenovationDeductionRecordRepository =
  createPrismaChildRearingRenovationDeductionRecordRepository();
const certifiedHousingConstructionCreditRecordRepository =
  createPrismaCertifiedHousingConstructionCreditRecordRepository();
const certifiedHousingConstructionCreditCarryforwardRepository =
  createPrismaCertifiedHousingConstructionCreditCarryforwardRepository();
const incomeDeductionRepository = createPrismaIncomeDeductionRepository();
const mortgageDeductionRecordRepository = createPrismaMortgageDeductionRecordRepository();
const residentTaxAdjustmentDeductionRecordRepository =
  createPrismaResidentTaxAdjustmentDeductionRecordRepository();
const employmentIncomeRecordRepository = createPrismaEmploymentIncomeRecordRepository();
const cashflowEntryRepository = createPrismaCashflowEntryRepository();
const assetBalanceSnapshotRepository = createPrismaAssetBalanceSnapshotRepository();

export async function setCryptoCostMethod(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const cryptoCostMethod = requireString(formData, "cryptoCostMethod");
  const tab = optionalString(formData, "tab");

  const { redirectTo } = await setCryptoCostMethodCore(taxYearRepository, {
    year,
    cryptoCostMethod,
    tab,
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(redirectTo);
}

export async function importMoneyForwardCsv(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("CSVファイルを選択してください");
  }

  const text = await decodeCsvFile(file);
  const { rows, skippedRows } = parseMoneyForwardCashflowCsv(text);

  const taxYear = await getOrCreateTaxYear(year);

  await cashflowEntryRepository.importMoneyForwardCsv({
    taxYearId: taxYear.id,
    fileName: file.name,
    rows: rows.map((row) => ({
      date: row.date,
      content: row.content,
      amountJpy: row.amountJpy.toString(),
      direction: row.direction,
      largeCategory: row.largeCategory,
      middleCategory: row.middleCategory,
      institution: row.institution,
      memo: row.memo,
      isCalculationTarget: row.isCalculationTarget,
    })),
  });

  revalidatePath("/import");
  revalidatePath("/");

  if (skippedRows.length > 0) {
    redirect(
      `/import?year=${year}&imported=${rows.length}&skipped=${skippedRows.length}`,
    );
  }
  redirect(`/import?year=${year}&imported=${rows.length}`);
}

export async function importCryptoExchangeCsv(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const preset = (optionalString(formData, "preset") ?? "other") as ExchangeCsvPreset;
  const exchangeName = optionalString(formData, "exchangeName");
  const exchangeLabel =
    exchangeName ?? (isKnownExchangeCsvPreset(preset) ? EXCHANGE_LABELS[preset] : null);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("CSVファイルを選択してください");
  }

  const text = await decodeCsvFile(file);
  const hasManualMapping = [
    "dateColumn",
    "symbolColumn",
    "typeColumn",
    "buyValue",
    "sellValue",
    "quantityColumn",
    "unitPriceColumn",
    "feeColumn",
  ].some((key) => hasStringValue(formData, key));
  const { rows, skippedRows } = hasManualMapping
    ? parseExchangeCsv(text, {
        dateColumn: requireString(formData, "dateColumn"),
        symbolColumn: requireString(formData, "symbolColumn"),
        typeColumn: requireString(formData, "typeColumn"),
        buyValue: requireString(formData, "buyValue"),
        sellValue: requireString(formData, "sellValue"),
        quantityColumn: requireString(formData, "quantityColumn"),
        unitPriceColumn: requireString(formData, "unitPriceColumn"),
        feeColumn: optionalString(formData, "feeColumn") ?? undefined,
      } satisfies ExchangeCsvMapping)
    : parseExchangeCsv(preset, text);

  const taxYear = await getOrCreateTaxYear(year);

  await cryptoTradeRepository.importCsvBatch({
    taxYearId: taxYear.id,
    sourceType: `crypto_csv_${preset}`,
    fileName: file.name,
    rows: rows.map((row) => ({
      tradedAt: row.tradedAt,
      symbol: row.symbol,
      type: row.type,
      quantity: row.quantity.toString(),
      unitPriceJpy: row.unitPriceJpy.toString(),
      feeJpy: row.feeJpy.toString(),
      exchange: row.exchange ?? exchangeLabel,
      memo: row.memo ?? null,
      source: hasManualMapping
        ? `exchange_csv:${preset}:manual`
        : isKnownExchangeCsvPreset(preset)
          ? `exchange_csv:${preset}`
          : `exchange_csv:${preset}:auto`,
    })),
  });

  revalidatePath("/import");
  revalidatePath("/");

  if (skippedRows.length > 0) {
    redirect(
      `/import?year=${year}&tab=crypto&imported=${rows.length}&skipped=${skippedRows.length}`,
    );
  }
  redirect(`/import?year=${year}&tab=crypto&imported=${rows.length}`);
}

export async function addCryptoTrade(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await getOrCreateTaxYear(year);

  await cryptoTradeRepository.create({
    taxYearId: taxYear.id,
    tradedAt: new Date(requireString(formData, "tradedAt")),
    symbol: requireString(formData, "symbol").toUpperCase(),
    type: requireString(formData, "type") as never,
    quantity: requireString(formData, "quantity"),
    unitPriceJpy: requireString(formData, "unitPriceJpy"),
    marketValueUnitPriceJpy: optionalString(formData, "marketValueUnitPriceJpy"),
    feeJpy: optionalString(formData, "feeJpy") ?? "0",
    exchange: optionalString(formData, "exchange"),
    memo: optionalString(formData, "memo"),
    source: "manual",
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=crypto`);
}

export async function addInvestmentTrade(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await getOrCreateTaxYear(year);

  const isNisa = formData.get("isNisa") === "on";
  // チェックボックスは既定でオン(上場株式等)。外すと一般株式等(非上場株式)
  // として登録する。NISA口座は上場株式等等のみが対象のため、非上場株式との
  // 組み合わせは拒否する。
  const isListed = formData.get("isListed") === "on";
  if (isNisa && !isListed) {
    throw new Error("一般株式等(非上場株式)はNISA口座の対象外です");
  }

  const assetType = requireString(formData, "assetType");
  const isReit = formData.get("isReit") === "on";
  if (isReit && assetType !== "ETF") {
    throw new Error("J-REITは資産種別「ETF」の場合のみ指定できます");
  }
  const mutualFundHighForeignRatio = formData.get("mutualFundHighForeignRatio") === "on";
  if (mutualFundHighForeignRatio && assetType !== "MUTUAL_FUND") {
    throw new Error(
      "外貨建資産等の組入割合50%超75%以下は資産種別「投資信託」の場合のみ指定できます",
    );
  }
  const mutualFundVeryHighForeignRatio =
    formData.get("mutualFundVeryHighForeignRatio") === "on";
  if (mutualFundVeryHighForeignRatio && assetType !== "MUTUAL_FUND") {
    throw new Error(
      "外貨建資産等の組入割合75%超は資産種別「投資信託」の場合のみ指定できます",
    );
  }

  await investmentTradeRepository.create({
    taxYearId: taxYear.id,
    tradedAt: new Date(requireString(formData, "tradedAt")),
    symbol: requireString(formData, "symbol"),
    name: optionalString(formData, "name"),
    assetType: assetType as never,
    isReit,
    mutualFundHighForeignRatio,
    mutualFundVeryHighForeignRatio,
    isListed,
    type: requireString(formData, "type") as never,
    quantity: requireString(formData, "quantity"),
    unitPriceJpy: requireString(formData, "unitPriceJpy"),
    feeJpy: optionalString(formData, "feeJpy") ?? "0",
    accountType: requireString(formData, "accountType") as never,
    isNisa,
    nisaType: optionalString(formData, "nisaType") as never,
    isForeign: formData.get("isForeign") === "on",
    foreignTaxWithheldJpy: optionalString(formData, "foreignTaxWithheldJpy") ?? "0",
    distributionAdjustedForeignTaxJpy:
      optionalString(formData, "distributionAdjustedForeignTaxJpy") ?? "0",
    broker: optionalString(formData, "broker"),
    memo: optionalString(formData, "memo"),
    source: "manual",
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=investment`);
}

export async function deleteCryptoTrade(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await cryptoTradeRepository.delete(id);
  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=crypto`);
}

export async function addCryptoMarginTrade(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await getOrCreateTaxYear(year);

  await cryptoMarginTradeRepository.create({
    taxYearId: taxYear.id,
    settledAt: new Date(requireString(formData, "settledAt")),
    symbol: requireString(formData, "symbol").toUpperCase(),
    realizedPnlJpy: requireString(formData, "realizedPnlJpy"),
    feeJpy: optionalString(formData, "feeJpy") ?? "0",
    swapJpy: optionalString(formData, "swapJpy") ?? "0",
    exchange: optionalString(formData, "exchange"),
    memo: optionalString(formData, "memo"),
    source: "manual",
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=cryptoMargin`);
}

export async function deleteCryptoMarginTrade(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await cryptoMarginTradeRepository.delete(id);
  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=cryptoMargin`);
}

export async function addCryptoCreditTrade(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await getOrCreateTaxYear(year);

  await cryptoCreditTradeRepository.create({
    taxYearId: taxYear.id,
    settledAt: new Date(requireString(formData, "settledAt")),
    symbol: requireString(formData, "symbol").toUpperCase(),
    realizedPnlJpy: requireString(formData, "realizedPnlJpy"),
    feeJpy: optionalString(formData, "feeJpy") ?? "0",
    interestAdjustmentJpy: optionalString(formData, "interestAdjustmentJpy") ?? "0",
    exchange: optionalString(formData, "exchange"),
    memo: optionalString(formData, "memo"),
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=cryptoCredit`);
}

export async function deleteCryptoCreditTrade(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await cryptoCreditTradeRepository.delete(id);
  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=cryptoCredit`);
}

export async function addStockMarginTrade(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await getOrCreateTaxYear(year);

  await stockMarginTradeRepository.create({
    taxYearId: taxYear.id,
    settledAt: new Date(requireString(formData, "settledAt")),
    symbol: requireString(formData, "symbol").toUpperCase(),
    realizedPnlJpy: requireString(formData, "realizedPnlJpy"),
    feeJpy: optionalString(formData, "feeJpy") ?? "0",
    interestAdjustmentJpy: optionalString(formData, "interestAdjustmentJpy") ?? "0",
    broker: optionalString(formData, "broker"),
    memo: optionalString(formData, "memo"),
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=stockMargin`);
}

export async function deleteStockMarginTrade(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await stockMarginTradeRepository.delete(id);
  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=stockMargin`);
}

export async function importCryptoMarginCsv(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const exchangeLabel = optionalString(formData, "exchangeName");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("CSVファイルを選択してください");
  }

  const text = await decodeCsvFile(file);
  const { rows, skippedRows } = parseCryptoMarginCsv(text, {
    dateColumn: requireString(formData, "dateColumn"),
    symbolColumn: requireString(formData, "symbolColumn"),
    pnlColumn: requireString(formData, "pnlColumn"),
    feeColumn: optionalString(formData, "feeColumn") ?? undefined,
    swapColumn: optionalString(formData, "swapColumn") ?? undefined,
  } satisfies MarginCsvMapping);

  const taxYear = await getOrCreateTaxYear(year);

  await cryptoMarginTradeRepository.importCsvBatch({
    taxYearId: taxYear.id,
    sourceType: "crypto_margin_csv",
    fileName: file.name,
    rows: rows.map((row) => ({
      settledAt: row.settledAt,
      symbol: row.symbol,
      realizedPnlJpy: row.realizedPnlJpy.toString(),
      feeJpy: row.feeJpy.toString(),
      swapJpy: row.swapJpy.toString(),
      exchange: exchangeLabel,
      source: "crypto_margin_csv:manual",
    })),
  });

  revalidatePath("/import");
  revalidatePath("/");

  if (skippedRows.length > 0) {
    redirect(
      `/import?year=${year}&tab=cryptoMargin&imported=${rows.length}&skipped=${skippedRows.length}`,
    );
  }
  redirect(`/import?year=${year}&tab=cryptoMargin&imported=${rows.length}`);
}

export async function deleteInvestmentTrade(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await investmentTradeRepository.delete(id);
  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=investment`);
}

export async function addFuturesTrade(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await getOrCreateTaxYear(year);

  await futuresTradeRepository.create({
    taxYearId: taxYear.id,
    settledAt: new Date(requireString(formData, "settledAt")),
    symbol: requireString(formData, "symbol"),
    realizedPnlJpy: requireString(formData, "realizedPnlJpy"),
    feeJpy: optionalString(formData, "feeJpy") ?? "0",
    swapJpy: optionalString(formData, "swapJpy") ?? "0",
    broker: optionalString(formData, "broker"),
    memo: optionalString(formData, "memo"),
    source: "manual",
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=futures`);
}

export async function deleteFuturesTrade(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await futuresTradeRepository.delete(id);
  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=futures`);
}

export async function importFuturesCsv(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const brokerLabel = optionalString(formData, "brokerName");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("CSVファイルを選択してください");
  }

  const text = await decodeCsvFile(file);
  const { rows, skippedRows } = parseFuturesCsv(text, {
    dateColumn: requireString(formData, "dateColumn"),
    symbolColumn: requireString(formData, "symbolColumn"),
    pnlColumn: requireString(formData, "pnlColumn"),
    feeColumn: optionalString(formData, "feeColumn") ?? undefined,
    swapColumn: optionalString(formData, "swapColumn") ?? undefined,
  } satisfies FuturesCsvMapping);

  const taxYear = await getOrCreateTaxYear(year);

  await futuresTradeRepository.importCsvBatch({
    taxYearId: taxYear.id,
    sourceType: "futures_csv",
    fileName: file.name,
    rows: rows.map((row) => ({
      settledAt: row.settledAt,
      symbol: row.symbol,
      realizedPnlJpy: row.realizedPnlJpy.toString(),
      feeJpy: row.feeJpy.toString(),
      swapJpy: row.swapJpy.toString(),
      broker: brokerLabel,
      source: "futures_csv:manual",
    })),
  });

  revalidatePath("/import");
  revalidatePath("/");

  if (skippedRows.length > 0) {
    redirect(
      `/import?year=${year}&tab=futures&imported=${rows.length}&skipped=${skippedRows.length}`,
    );
  }
  redirect(`/import?year=${year}&tab=futures&imported=${rows.length}`);
}

export async function setFuturesLossCarryforward(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const originYear = Number(requireString(formData, "originYear"));
  const remainingAmountJpy = requireString(formData, "remainingAmountJpy");

  const { redirectTo } = await setFuturesLossCarryforwardCore(
    taxYearRepository,
    futuresLossCarryforwardRepository,
    { year, originYear, remainingAmountJpy },
  );

  revalidatePath("/import");
  revalidatePath("/");
  redirect(redirectTo);
}

export async function deleteFuturesLossCarryforward(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteFuturesLossCarryforwardCore(
    futuresLossCarryforwardRepository,
    { id, year },
  );

  revalidatePath("/import");
  revalidatePath("/");
  redirect(redirectTo);
}

/**
 * 前年分の先物取引に係る雑所得等・繰越控除の計算結果から、翌年に繰り越す損失の
 * 残高を一括登録する。既に当年分に発生年ごとの登録がある場合は上書きしない。
 */
export async function carryForwardFuturesLoss(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await getOrCreateTaxYear(year);
  const previousReport = await buildYearReport(year - 1);
  const candidates =
    previousReport?.futuresLossCarryforward.carryforwardToNextYear ?? [];

  const existing = await futuresLossCarryforwardRepository.findByTaxYearId(taxYear.id);
  const existingYears = new Set(existing.map((e) => e.originYear));

  const toCreate = candidates.filter((c) => !existingYears.has(c.originYear));

  await futuresLossCarryforwardRepository.createMany(
    toCreate.map((c) => ({
      taxYearId: taxYear.id,
      originYear: c.originYear,
      remainingAmountJpy: c.remainingAmountJpy.toString(),
    })),
  );

  revalidatePath("/import");
  revalidatePath("/");
  redirect(
    `/import?year=${year}&tab=futuresLossCarryforward&futuresLossCarried=${toCreate.length}`,
  );
}

export async function setBrokerAnnualReport(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const broker = requireString(formData, "broker");
  const accountType = requireString(formData, "accountType");
  const proceedsJpy = requireString(formData, "proceedsJpy");
  const acquisitionCostJpy = requireString(formData, "acquisitionCostJpy");
  const dividendJpy = optionalString(formData, "dividendJpy") ?? "0";
  const taxYear = await getOrCreateTaxYear(year);

  await brokerAnnualReportRepository.upsert({
    taxYearId: taxYear.id,
    broker,
    accountType: accountType as never,
    proceedsJpy,
    acquisitionCostJpy,
    dividendJpy,
  });

  revalidatePath("/import");
  redirect(`/import?year=${year}&tab=brokerReport`);
}

export async function deleteBrokerAnnualReport(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await brokerAnnualReportRepository.delete(id);
  revalidatePath("/import");
  redirect(`/import?year=${year}&tab=brokerReport`);
}

export async function importBrokerAnnualReportCsv(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("CSVファイルを選択してください");
  }

  const mapping: AnnualReportCsvMapping = {
    brokerColumn: requireString(formData, "brokerColumn"),
    accountTypeColumn: requireString(formData, "accountTypeColumn"),
    proceedsColumn: requireString(formData, "proceedsColumn"),
    acquisitionCostColumn: requireString(formData, "acquisitionCostColumn"),
    dividendColumn: optionalString(formData, "dividendColumn") ?? undefined,
  };

  const text = await decodeCsvFile(file);
  const { rows, skippedRows } = parseBrokerAnnualReportCsv(text, mapping);

  const taxYear = await getOrCreateTaxYear(year);

  await brokerAnnualReportRepository.upsertMany(
    rows.map((row) => ({
      taxYearId: taxYear.id,
      broker: row.broker,
      accountType: row.accountType,
      proceedsJpy: row.proceedsJpy.toString(),
      acquisitionCostJpy: row.acquisitionCostJpy.toString(),
      dividendJpy: row.dividendJpy.toString(),
    })),
  );

  revalidatePath("/import");

  if (skippedRows.length > 0) {
    redirect(
      `/import?year=${year}&tab=brokerReport&imported=${rows.length}&skipped=${skippedRows.length}`,
    );
  }
  redirect(`/import?year=${year}&tab=brokerReport&imported=${rows.length}`);
}

export async function setOpeningBalance(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await getOrCreateTaxYear(year);
  const assetClass = requireString(formData, "assetClass") as
    | "CRYPTO"
    | "INVESTMENT";
  const symbol = requireString(formData, "symbol").toUpperCase();
  // NISA口座・一般株式等(非上場株式)区分は投資のみ有効。暗号資産では常に
  // isNisa=false・isListed=trueとして扱う。
  const isNisa = assetClass === "INVESTMENT" && formData.get("isNisa") === "on";
  const isListed = assetClass !== "INVESTMENT" || formData.get("isListed") === "on";
  if (isNisa && !isListed) {
    throw new Error("一般株式等(非上場株式)はNISA口座の対象外です");
  }
  const quantity = requireString(formData, "quantity");
  const costBasisJpy = requireString(formData, "costBasisJpy");

  await openingBalanceRepository.upsert({
    taxYearId: taxYear.id,
    assetClass,
    symbol,
    isNisa,
    isListed,
    quantity,
    costBasisJpy,
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=opening`);
}

export async function deleteOpeningBalance(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await openingBalanceRepository.delete(id);
  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=opening`);
}

/**
 * 期首残高の金融機関別内訳を登録する。同一銘柄を複数の金融機関にまたがって
 * 保有している場合に、マネーフォワード資産残高突合の数量チェックで
 * 期首残高をどの金融機関に帰属させるべきか判定できるようにするための任意入力。
 */
export async function setOpeningBalanceByInstitution(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await getOrCreateTaxYear(year);
  const assetClass = requireString(formData, "assetClass") as
    | "CRYPTO"
    | "INVESTMENT";
  const symbol = requireString(formData, "symbol").trim().toUpperCase();
  const institution = requireString(formData, "institution").trim();
  const quantity = requireString(formData, "quantity");

  await openingBalanceByInstitutionRepository.upsert({
    taxYearId: taxYear.id,
    assetClass,
    symbol,
    institution,
    quantity,
  });

  revalidatePath("/import");
  redirect(`/import?year=${year}&tab=assetBalance`);
}

export async function deleteOpeningBalanceByInstitution(
  formData: FormData,
): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await openingBalanceByInstitutionRepository.delete(id);
  revalidatePath("/import");
  redirect(`/import?year=${year}&tab=assetBalance`);
}

/**
 * 前年の期末残高(取引と期首残高から再計算した結果)を、当年の期首残高として
 * 一括登録する。既に当年の期首残高が登録されている銘柄は上書きしない。
 */
export async function carryForwardOpeningBalances(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await getOrCreateTaxYear(year);
  const candidates = await buildCarryForwardCandidates(year - 1);

  const existing = await openingBalanceRepository.findByTaxYearId(taxYear.id);
  const existingKeys = new Set(
    existing.map((e) => `${e.assetClass}:${e.symbol}:${e.isNisa}:${e.isListed}`),
  );

  const toCreate = candidates.filter(
    (c) => !existingKeys.has(`${c.assetClass}:${c.symbol}:${c.isNisa}:${c.isListed}`),
  );

  await openingBalanceRepository.createMany(
    toCreate.map((c) => ({
      taxYearId: taxYear.id,
      assetClass: c.assetClass,
      symbol: c.symbol,
      isNisa: c.isNisa,
      isListed: c.isListed,
      quantity: c.quantity,
      costBasisJpy: c.costBasisJpy,
    })),
  );

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=opening&carried=${toCreate.length}`);
}

export async function setLossCarryforward(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const originYear = Number(requireString(formData, "originYear"));
  const remainingAmountJpy = requireString(formData, "remainingAmountJpy");
  if (!Number.isInteger(originYear) || originYear > year) {
    throw new Error("損失の発生年は対象年分以前の年である必要があります");
  }
  const taxYear = await getOrCreateTaxYear(year);

  await investmentLossCarryforwardRepository.upsert({
    taxYearId: taxYear.id,
    originYear,
    remainingAmountJpy,
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=lossCarryforward`);
}

export async function deleteLossCarryforward(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await investmentLossCarryforwardRepository.delete(id);
  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=lossCarryforward`);
}

/**
 * 前年分の譲渡損益・繰越控除の計算結果から、翌年に繰り越す譲渡損失の残高を
 * 一括登録する。既に当年分に発生年ごとの登録がある場合は上書きしない。
 */
export async function carryForwardInvestmentLoss(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await getOrCreateTaxYear(year);
  const previousReport = await buildYearReport(year - 1);
  const candidates = previousReport?.lossCarryforward.carryforwardToNextYear ?? [];

  const existing = await investmentLossCarryforwardRepository.findByTaxYearId(
    taxYear.id,
  );
  const existingYears = new Set(existing.map((e) => e.originYear));

  const toCreate = candidates.filter((c) => !existingYears.has(c.originYear));

  await investmentLossCarryforwardRepository.createMany(
    toCreate.map((c) => ({
      taxYearId: taxYear.id,
      originYear: c.originYear,
      remainingAmountJpy: c.remainingAmountJpy.toString(),
    })),
  );

  revalidatePath("/import");
  revalidatePath("/");
  redirect(
    `/import?year=${year}&tab=lossCarryforward&lossCarried=${toCreate.length}`,
  );
}

export async function setNisaLifetimeQuota(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const nisaType = requireString(formData, "nisaType");
  const openingUsedJpy = requireString(formData, "openingUsedJpy");
  const soldCostBasisJpy = optionalString(formData, "soldCostBasisJpy") ?? "0";
  if (nisaType !== "TSUMITATE" && nisaType !== "GROWTH") {
    throw new Error("NISA枠区分が不正です");
  }
  const taxYear = await getOrCreateTaxYear(year);

  await nisaLifetimeQuotaRepository.upsert({
    taxYearId: taxYear.id,
    nisaType,
    openingUsedJpy,
    soldCostBasisJpy,
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=nisaLifetime`);
}

export async function deleteNisaLifetimeQuota(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await nisaLifetimeQuotaRepository.delete(id);
  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=nisaLifetime`);
}

/**
 * 前年分のNISA生涯投資枠の計算結果(当年末の使用額)から、翌年の年始使用額を
 * 枠区分ごとに一括登録する。既に当年分に登録がある区分は上書きしない。
 */
export async function carryForwardNisaLifetimeQuota(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await getOrCreateTaxYear(year);
  const previousReport = await buildYearReport(year - 1);
  const candidates = previousReport
    ? deriveNisaLifetimeCarryForwardCandidates(previousReport.nisaLifetimeQuota)
    : [];

  const existing = await nisaLifetimeQuotaRepository.findByTaxYearId(
    taxYear.id,
  );
  const existingTypes = new Set(existing.map((e) => e.nisaType));

  const toCreate = candidates.filter((c) => !existingTypes.has(c.nisaType));

  await nisaLifetimeQuotaRepository.createMany(
    toCreate.map((c) => ({
      taxYearId: taxYear.id,
      nisaType: c.nisaType,
      openingUsedJpy: c.openingUsedJpy,
    })),
  );

  revalidatePath("/import");
  revalidatePath("/");
  redirect(
    `/import?year=${year}&tab=nisaLifetime&nisaLifetimeCarried=${toCreate.length}`,
  );
}

export async function importAssetBalanceCsv(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("CSVファイルを選択してください");
  }

  const text = await decodeCsvFile(file);
  const { rows, skippedRows } = parseMoneyForwardAssetBalanceCsv(text, {
    institutionColumn: requireString(formData, "institutionColumn"),
    assetNameColumn: requireString(formData, "assetNameColumn"),
    balanceColumn: requireString(formData, "balanceColumn"),
    dateColumn: optionalString(formData, "dateColumn") ?? undefined,
    categoryColumn: optionalString(formData, "categoryColumn") ?? undefined,
    quantityColumn: optionalString(formData, "quantityColumn") ?? undefined,
  } satisfies AssetBalanceCsvMapping);

  const taxYear = await getOrCreateTaxYear(year);

  await assetBalanceSnapshotRepository.importCsvBatch({
    taxYearId: taxYear.id,
    sourceType: "moneyforward_assets",
    fileName: file.name,
    rows: rows.map((row) => ({
      snapshotDate: row.snapshotDate ?? null,
      category: row.category,
      institution: row.institution,
      assetName: row.assetName,
      balanceJpy: row.balanceJpy.toString(),
      quantity: row.quantity ? row.quantity.toString() : null,
    })),
  });

  revalidatePath("/import");

  if (skippedRows.length > 0) {
    redirect(
      `/import?year=${year}&tab=assetBalance&imported=${rows.length}&skipped=${skippedRows.length}`,
    );
  }
  redirect(`/import?year=${year}&tab=assetBalance&imported=${rows.length}`);
}

export async function deleteAssetBalanceImportBatch(formData: FormData): Promise<void> {
  const importBatchId = Number(requireString(formData, "importBatchId"));
  const year = Number(requireString(formData, "year"));
  await assetBalanceSnapshotRepository.deleteImportBatch(importBatchId);
  revalidatePath("/import");
  redirect(`/import?year=${year}&tab=assetBalance`);
}

/**
 * マネーフォワードの資産名(例:「ビットコイン」)とアプリの銘柄シンボル
 * (例:「BTC」)の対応を登録する。年に紐付かない全年共通のマスタデータ。
 */
export async function setAssetSymbolMapping(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const assetName = requireString(formData, "assetName");
  const symbol = requireString(formData, "symbol");

  const { redirectTo } = await setAssetSymbolMappingCore(assetSymbolMappingRepository, {
    year,
    assetName,
    symbol,
  });

  revalidatePath("/import");
  redirect(redirectTo);
}

export async function deleteAssetSymbolMapping(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteAssetSymbolMappingCore(assetSymbolMappingRepository, {
    id,
    year,
  });

  revalidatePath("/import");
  redirect(redirectTo);
}

/**
 * 銘柄の現在価格(時価)を手入力で登録する。自動取得の仕組みは持たず、年に
 * 紐付かない全年共通のマスタデータ。`/unrealized-gain`の現在価格欄の初期値と、
 * マネーフォワード資産残高突合の評価額比較(valueCheck)の両方で参照する。
 */
export async function setMarketPrice(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const symbol = requireString(formData, "symbol");
  const priceJpy = requireString(formData, "priceJpy");

  const { redirectTo } = await setMarketPriceCore(marketPriceRepository, {
    year,
    symbol,
    priceJpy,
  });

  revalidatePath("/import");
  revalidatePath("/unrealized-gain");
  redirect(redirectTo);
}

export async function deleteMarketPrice(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteMarketPriceCore(marketPriceRepository, { id, year });

  revalidatePath("/import");
  revalidatePath("/unrealized-gain");
  redirect(redirectTo);
}

export async function setForeignTaxCreditCarryforward(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const originYear = Number(requireString(formData, "originYear"));
  const remainingAmountJpy = requireString(formData, "remainingAmountJpy");

  const { redirectTo } = await setForeignTaxCreditCarryforwardCore(
    taxYearRepository,
    foreignTaxCreditCarryforwardRepository,
    { year, originYear, remainingAmountJpy },
  );

  revalidatePath("/import");
  redirect(redirectTo);
}

export async function deleteForeignTaxCreditCarryforward(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteForeignTaxCreditCarryforwardCore(
    foreignTaxCreditCarryforwardRepository,
    { id, year },
  );

  revalidatePath("/import");
  redirect(redirectTo);
}

/**
 * 外国税額控除シミュレーター(/foreign-tax-credit)の当年分の計算結果のうち、
 * 翌年以後に繰り越す控除限度超過額(発生年ごと)を、翌年分の
 * ForeignTaxCreditCarryforward としてまとめて登録する。
 *
 * 損失の繰越控除(carryForwardInvestmentLoss)と異なり、外国税額控除の計算に
 * 必要な所得税額・所得総額等はDBに保存されない都度入力のため、前年分を
 * サーバー側で再計算することはできない。そのため、シミュレーターの計算結果を
 * 画面から直接この年の翌年分として保存する方式にしている
 * (既に翌年分に同じ発生年の登録がある場合は上書きしない)。
 */
export async function carryForwardForeignTaxCreditExcess(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const entriesJson = requireString(formData, "carryforwardToNextYearJson");
  const entries = JSON.parse(entriesJson) as { originYear: number; remainingAmountJpy: string }[];

  const nextTaxYear = await getOrCreateTaxYear(year + 1);
  const existing = await foreignTaxCreditCarryforwardRepository.findByTaxYearId(
    nextTaxYear.id,
  );
  const existingYears = new Set(existing.map((e) => e.originYear));
  const toCreate = entries.filter((e) => !existingYears.has(e.originYear));

  await foreignTaxCreditCarryforwardRepository.createMany(
    toCreate.map((e) => ({
      taxYearId: nextTaxYear.id,
      originYear: e.originYear,
      remainingAmountJpy: e.remainingAmountJpy,
    })),
  );

  revalidatePath("/import");
  redirect(
    `/foreign-tax-credit?year=${year}&excessCarried=${toCreate.length}`,
  );
}

export async function setForeignTaxCreditSpareLimitCarryforward(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const originYear = Number(requireString(formData, "originYear"));
  const remainingAmountJpy = requireString(formData, "remainingAmountJpy");

  const { redirectTo } = await setForeignTaxCreditSpareLimitCarryforwardCore(
    taxYearRepository,
    foreignTaxCreditSpareLimitCarryforwardRepository,
    { year, originYear, remainingAmountJpy },
  );

  revalidatePath("/import");
  redirect(redirectTo);
}

export async function deleteForeignTaxCreditSpareLimitCarryforward(
  formData: FormData,
): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteForeignTaxCreditSpareLimitCarryforwardCore(
    foreignTaxCreditSpareLimitCarryforwardRepository,
    { id, year },
  );

  revalidatePath("/import");
  redirect(redirectTo);
}

/**
 * 外国税額控除シミュレーター(/foreign-tax-credit)の当年分の計算結果のうち、
 * 翌年以後に繰り越す控除余裕額(発生年ごと)を、翌年分の
 * ForeignTaxCreditSpareLimitCarryforward としてまとめて登録する。
 * carryForwardForeignTaxCreditExcess(限度超過額側)と同様、外国税額控除の
 * 計算に必要な所得税額・所得総額等はDBに保存されない都度入力のため、
 * シミュレーターの計算結果を画面から直接この年の翌年分として保存する方式にしている
 * (既に翌年分に同じ発生年の登録がある場合は上書きしない)。
 */
export async function carryForwardForeignTaxCreditSpareLimit(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const entriesJson = requireString(formData, "spareLimitCarryforwardToNextYearJson");
  const entries = JSON.parse(entriesJson) as { originYear: number; remainingAmountJpy: string }[];

  const nextTaxYear = await getOrCreateTaxYear(year + 1);
  const existing =
    await foreignTaxCreditSpareLimitCarryforwardRepository.findByTaxYearId(
      nextTaxYear.id,
    );
  const existingYears = new Set(existing.map((e) => e.originYear));
  const toCreate = entries.filter((e) => !existingYears.has(e.originYear));

  await foreignTaxCreditSpareLimitCarryforwardRepository.createMany(
    toCreate.map((e) => ({
      taxYearId: nextTaxYear.id,
      originYear: e.originYear,
      remainingAmountJpy: e.remainingAmountJpy,
    })),
  );

  revalidatePath("/import");
  redirect(
    `/foreign-tax-credit?year=${year}&spareLimitCarried=${toCreate.length}`,
  );
}

/**
 * 外国税額控除シミュレーター(/foreign-tax-credit)の当年分の試算結果(合計控除額)を
 * ForeignTaxCreditRecord として登録する。住宅ローン控除(saveMortgageDeductionRecord)
 * と同様、下書きCSV(/api/export)の税額控除欄への自動反映に使う。既に登録済みの場合は
 * 上書きする。
 */
export async function saveForeignTaxCreditRecord(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const totalCreditJpy = requireString(formData, "totalCreditJpy");
  const nationalTaxCreditJpy = requireString(formData, "nationalTaxCreditJpy");
  const residentTaxCreditJpy = requireString(formData, "residentTaxCreditJpy");

  const taxYear = await getOrCreateTaxYear(year);
  await foreignTaxCreditRecordRepository.upsert({
    taxYearId: taxYear.id,
    totalCreditJpy,
    nationalTaxCreditJpy,
    residentTaxCreditJpy,
  });

  revalidatePath("/foreign-tax-credit");
  redirect(`/foreign-tax-credit?year=${year}&foreignTaxCreditSaved=1`);
}

/**
 * saveForeignTaxCreditRecordで登録した当年分のForeignTaxCreditRecordを削除する
 * (deleteMortgageDeductionRecordと同様の取り消し操作)。
 */
export async function deleteForeignTaxCreditRecord(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await foreignTaxCreditRecordRepository.deleteByTaxYearId(taxYear.id);
  }

  revalidatePath("/tax-estimate");
  revalidatePath("/foreign-tax-credit");
  redirect(`/foreign-tax-credit?year=${year}&foreignTaxCreditDeleted=1`);
}

/**
 * 政党等・認定NPO法人等・公益社団法人等寄附金特別控除シミュレーター
 * (/donation-tax-credit)の当年分の試算結果(所得税分の合計控除額・条例指定を
 * 受けている分の住民税の寄附金控除(基本控除)額)を DonationTaxCreditRecord
 * として登録する。住宅ローン控除(saveMortgageDeductionRecord)・外国税額控除
 * (saveForeignTaxCreditRecord)と同様、`/tax-estimate`の合計税額試算・下書きCSV
 * (/api/export)の税額控除欄への自動反映に使う。既に登録済みの場合は上書きする。
 */
export async function saveDonationTaxCreditRecord(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const totalTaxCreditJpy = requireString(formData, "totalTaxCreditJpy");
  const residentTaxBasicDeductionJpy = requireString(formData, "residentTaxBasicDeductionJpy");

  const taxYear = await getOrCreateTaxYear(year);
  await donationTaxCreditRecordRepository.upsert({
    taxYearId: taxYear.id,
    totalTaxCreditJpy,
    residentTaxBasicDeductionJpy,
  });

  revalidatePath("/tax-estimate");
  revalidatePath("/donation-tax-credit");
  redirect(`/donation-tax-credit?year=${year}&donationTaxCreditSaved=1`);
}

/**
 * saveDonationTaxCreditRecordで登録した当年分のDonationTaxCreditRecordを削除する
 * (deleteMortgageDeductionRecordと同様の取り消し操作)。
 */
export async function deleteDonationTaxCreditRecord(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await donationTaxCreditRecordRepository.deleteByTaxYearId(taxYear.id);
  }

  revalidatePath("/tax-estimate");
  revalidatePath("/donation-tax-credit");
  redirect(`/donation-tax-credit?year=${year}&donationTaxCreditDeleted=1`);
}

/**
 * 分配時調整外国税相当額控除シミュレーター(/distribution-adjusted-foreign-tax-credit)
 * の当年分の控除額を DistributionAdjustedForeignTaxCreditRecord として登録する。
 * 外国税額控除(saveForeignTaxCreditRecord)と同様、`/tax-estimate`の合計税額試算・
 * 下書きCSV(/api/export)の税額控除欄への自動反映に使う。既に登録済みの場合は上書きする。
 */
export async function saveDistributionAdjustedForeignTaxCreditRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const creditJpy = requireString(formData, "creditJpy");

  const taxYear = await getOrCreateTaxYear(year);
  await distributionAdjustedForeignTaxCreditRecordRepository.upsert({
    taxYearId: taxYear.id,
    creditJpy,
  });

  revalidatePath("/tax-estimate");
  revalidatePath("/distribution-adjusted-foreign-tax-credit");
  redirect(`/distribution-adjusted-foreign-tax-credit?year=${year}&saved=1`);
}

/**
 * saveDistributionAdjustedForeignTaxCreditRecordで登録した当年分の
 * DistributionAdjustedForeignTaxCreditRecordを削除する
 * (deleteMortgageDeductionRecordと同様の取り消し操作)。
 */
export async function deleteDistributionAdjustedForeignTaxCreditRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await distributionAdjustedForeignTaxCreditRecordRepository.deleteByTaxYearId(taxYear.id);
  }

  revalidatePath("/tax-estimate");
  revalidatePath("/distribution-adjusted-foreign-tax-credit");
  redirect(`/distribution-adjusted-foreign-tax-credit?year=${year}&deleted=1`);
}

/**
 * 住宅耐震改修特別控除シミュレーター(/earthquake-renovation-deduction)の
 * 当年分の控除額を EarthquakeRenovationDeductionRecord として登録する。
 * 分配時調整外国税相当額控除(saveDistributionAdjustedForeignTaxCreditRecord)と
 * 同様、`/tax-estimate`の合計税額試算・下書きCSV(/api/export)の税額控除欄への
 * 自動反映に使う。既に登録済みの場合は上書きする。
 */
export async function saveEarthquakeRenovationDeductionRecord(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const creditJpy = requireString(formData, "creditJpy");

  const { redirectTo } = await saveEarthquakeRenovationDeductionRecordCore(
    taxYearRepository,
    earthquakeRenovationDeductionRecordRepository,
    { year, creditJpy },
  );

  revalidatePath("/tax-estimate");
  revalidatePath("/earthquake-renovation-deduction");
  redirect(redirectTo);
}

/**
 * saveEarthquakeRenovationDeductionRecordで登録した当年分の
 * EarthquakeRenovationDeductionRecordを削除する
 * (deleteDistributionAdjustedForeignTaxCreditRecordと同様の取り消し操作)。
 */
export async function deleteEarthquakeRenovationDeductionRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteEarthquakeRenovationDeductionRecordCore(
    taxYearRepository,
    earthquakeRenovationDeductionRecordRepository,
    { year },
  );

  revalidatePath("/tax-estimate");
  revalidatePath("/earthquake-renovation-deduction");
  redirect(redirectTo);
}

/**
 * 省エネ改修工事をした場合の住宅特定改修特別税額控除シミュレーター
 * (/energy-saving-renovation-deduction)の当年分の控除額を
 * EnergySavingRenovationDeductionRecord として登録する。住宅耐震改修特別控除
 * (saveEarthquakeRenovationDeductionRecord)と同様、`/tax-estimate`の合計税額
 * 試算・下書きCSV(/api/export)の税額控除欄への自動反映に使う。既に登録済みの
 * 場合は上書きする。
 */
export async function saveEnergySavingRenovationDeductionRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const creditJpy = requireString(formData, "creditJpy");

  const { redirectTo } = await saveEnergySavingRenovationDeductionRecordCore(
    taxYearRepository,
    energySavingRenovationDeductionRecordRepository,
    { year, creditJpy },
  );

  revalidatePath("/tax-estimate");
  revalidatePath("/energy-saving-renovation-deduction");
  redirect(redirectTo);
}

/**
 * saveEnergySavingRenovationDeductionRecordで登録した当年分の
 * EnergySavingRenovationDeductionRecordを削除する
 * (deleteEarthquakeRenovationDeductionRecordと同様の取り消し操作)。
 */
export async function deleteEnergySavingRenovationDeductionRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteEnergySavingRenovationDeductionRecordCore(
    taxYearRepository,
    energySavingRenovationDeductionRecordRepository,
    { year },
  );

  revalidatePath("/tax-estimate");
  revalidatePath("/energy-saving-renovation-deduction");
  redirect(redirectTo);
}

/**
 * バリアフリー改修工事をした場合の住宅特定改修特別税額控除シミュレーター
 * (/barrier-free-renovation-deduction)の当年分の控除額を
 * BarrierFreeRenovationDeductionRecord として登録する。省エネ改修工事の住宅特定
 * 改修特別税額控除(saveEnergySavingRenovationDeductionRecord)と同様、
 * `/tax-estimate`の合計税額試算・下書きCSV(/api/export)の税額控除欄への
 * 自動反映に使う。既に登録済みの場合は上書きする。
 */
export async function saveBarrierFreeRenovationDeductionRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const creditJpy = requireString(formData, "creditJpy");

  const { redirectTo } = await saveBarrierFreeRenovationDeductionRecordCore(
    taxYearRepository,
    barrierFreeRenovationDeductionRecordRepository,
    { year, creditJpy },
  );

  revalidatePath("/tax-estimate");
  revalidatePath("/barrier-free-renovation-deduction");
  redirect(redirectTo);
}

/**
 * saveBarrierFreeRenovationDeductionRecordで登録した当年分の
 * BarrierFreeRenovationDeductionRecordを削除する
 * (deleteEnergySavingRenovationDeductionRecordと同様の取り消し操作)。
 */
export async function deleteBarrierFreeRenovationDeductionRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteBarrierFreeRenovationDeductionRecordCore(
    taxYearRepository,
    barrierFreeRenovationDeductionRecordRepository,
    { year },
  );

  revalidatePath("/tax-estimate");
  revalidatePath("/barrier-free-renovation-deduction");
  redirect(redirectTo);
}

/**
 * 多世帯同居改修工事をした場合の住宅特定改修特別税額控除シミュレーター
 * (/multi-household-renovation-deduction)の当年分の控除額を
 * MultiHouseholdRenovationDeductionRecord として登録する。バリアフリー改修工事の
 * 住宅特定改修特別税額控除(saveBarrierFreeRenovationDeductionRecord)と同様、
 * `/tax-estimate`の合計税額試算・下書きCSV(/api/export)の税額控除欄への
 * 自動反映に使う。既に登録済みの場合は上書きする。
 */
export async function saveMultiHouseholdRenovationDeductionRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const creditJpy = requireString(formData, "creditJpy");

  const { redirectTo } = await saveMultiHouseholdRenovationDeductionRecordCore(
    taxYearRepository,
    multiHouseholdRenovationDeductionRecordRepository,
    { year, creditJpy },
  );

  revalidatePath("/tax-estimate");
  revalidatePath("/multi-household-renovation-deduction");
  redirect(redirectTo);
}

/**
 * saveMultiHouseholdRenovationDeductionRecordで登録した当年分の
 * MultiHouseholdRenovationDeductionRecordを削除する
 * (deleteBarrierFreeRenovationDeductionRecordと同様の取り消し操作)。
 */
export async function deleteMultiHouseholdRenovationDeductionRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteMultiHouseholdRenovationDeductionRecordCore(
    taxYearRepository,
    multiHouseholdRenovationDeductionRecordRepository,
    { year },
  );

  revalidatePath("/tax-estimate");
  revalidatePath("/multi-household-renovation-deduction");
  redirect(redirectTo);
}

/**
 * 耐久性向上改修工事をした場合の住宅特定改修特別税額控除シミュレーター
 * (/durability-improvement-renovation-deduction)の当年分の控除額を
 * DurabilityImprovementRenovationDeductionRecord として登録する。多世帯同居改修工事の
 * 住宅特定改修特別税額控除(saveMultiHouseholdRenovationDeductionRecord)と同様、
 * `/tax-estimate`の合計税額試算・下書きCSV(/api/export)の税額控除欄への
 * 自動反映に使う。既に登録済みの場合は上書きする。
 */
export async function saveDurabilityImprovementRenovationDeductionRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const creditJpy = requireString(formData, "creditJpy");

  const taxYear = await getOrCreateTaxYear(year);
  await durabilityImprovementRenovationDeductionRecordRepository.upsert({
    taxYearId: taxYear.id,
    creditJpy,
  });

  revalidatePath("/tax-estimate");
  revalidatePath("/durability-improvement-renovation-deduction");
  redirect(`/durability-improvement-renovation-deduction?year=${year}&saved=1`);
}

/**
 * saveDurabilityImprovementRenovationDeductionRecordで登録した当年分の
 * DurabilityImprovementRenovationDeductionRecordを削除する
 * (deleteMultiHouseholdRenovationDeductionRecordと同様の取り消し操作)。
 */
export async function deleteDurabilityImprovementRenovationDeductionRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await durabilityImprovementRenovationDeductionRecordRepository.deleteByTaxYearId(taxYear.id);
  }

  revalidatePath("/tax-estimate");
  revalidatePath("/durability-improvement-renovation-deduction");
  redirect(`/durability-improvement-renovation-deduction?year=${year}&deleted=1`);
}

/**
 * 子育て対応改修工事をした場合の住宅特定改修特別税額控除シミュレーター
 * (/child-rearing-renovation-deduction)の当年分の控除額を
 * ChildRearingRenovationDeductionRecord として登録する。耐久性向上改修工事の
 * 住宅特定改修特別税額控除(saveDurabilityImprovementRenovationDeductionRecord)と
 * 同様、`/tax-estimate`の合計税額試算・下書きCSV(/api/export)の税額控除欄への
 * 自動反映に使う。既に登録済みの場合は上書きする。
 */
export async function saveChildRearingRenovationDeductionRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const creditJpy = requireString(formData, "creditJpy");

  const taxYear = await getOrCreateTaxYear(year);
  await childRearingRenovationDeductionRecordRepository.upsert({
    taxYearId: taxYear.id,
    creditJpy,
  });

  revalidatePath("/tax-estimate");
  revalidatePath("/child-rearing-renovation-deduction");
  redirect(`/child-rearing-renovation-deduction?year=${year}&saved=1`);
}

/**
 * saveChildRearingRenovationDeductionRecordで登録した当年分の
 * ChildRearingRenovationDeductionRecordを削除する
 * (deleteDurabilityImprovementRenovationDeductionRecordと同様の取り消し操作)。
 */
export async function deleteChildRearingRenovationDeductionRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await childRearingRenovationDeductionRecordRepository.deleteByTaxYearId(taxYear.id);
  }

  revalidatePath("/tax-estimate");
  revalidatePath("/child-rearing-renovation-deduction");
  redirect(`/child-rearing-renovation-deduction?year=${year}&deleted=1`);
}

/**
 * 認定住宅等新築等特別税額控除シミュレーター
 * (/certified-housing-construction-credit)の当年分の控除額を
 * CertifiedHousingConstructionCreditRecord として登録する。子育て対応改修工事の
 * 住宅特定改修特別税額控除(saveChildRearingRenovationDeductionRecord)と同様、
 * `/tax-estimate`の合計税額試算・下書きCSV(/api/export)の税額控除欄への
 * 自動反映に使う。既に登録済みの場合は上書きする。
 */
export async function saveCertifiedHousingConstructionCreditRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const creditJpy = requireString(formData, "creditJpy");

  const taxYear = await getOrCreateTaxYear(year);
  await certifiedHousingConstructionCreditRecordRepository.upsert({
    taxYearId: taxYear.id,
    creditJpy,
  });

  revalidatePath("/tax-estimate");
  revalidatePath("/certified-housing-construction-credit");
  redirect(`/certified-housing-construction-credit?year=${year}&saved=1`);
}

/**
 * saveCertifiedHousingConstructionCreditRecordで登録した当年分の
 * CertifiedHousingConstructionCreditRecordを削除する
 * (deleteChildRearingRenovationDeductionRecordと同様の取り消し操作)。
 */
export async function deleteCertifiedHousingConstructionCreditRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await certifiedHousingConstructionCreditRecordRepository.deleteByTaxYearId(taxYear.id);
  }

  revalidatePath("/tax-estimate");
  revalidatePath("/certified-housing-construction-credit");
  redirect(`/certified-housing-construction-credit?year=${year}&deleted=1`);
}

/**
 * 認定住宅等新築等特別税額控除(機能87)の居住年分の試算画面で、居住年の
 * 所得税額から控除しきれなかった金額(控除未済税額控除額)を、雑損失の繰越控除
 * (carryForwardCasualtyLossExcess)と同様に画面から直接翌年分の
 * CertifiedHousingConstructionCreditCarryforwardとして登録する(1年限りの
 * 繰越のため発生年の翌年のみを対象とする)。既に同じ年分の繰越が登録済みの
 * 場合は上書きする(他の`save*Record`アクションと同様、登録ボタンを押すたびに
 * 最新の試算結果で上書きする方式)。
 */
export async function carryForwardCertifiedHousingConstructionCreditExcess(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const remainingAmountJpy = requireString(formData, "remainingAmountJpy");

  const nextTaxYear = await getOrCreateTaxYear(year + 1);
  await certifiedHousingConstructionCreditCarryforwardRepository.upsert({
    taxYearId: nextTaxYear.id,
    originYear: year,
    remainingAmountJpy,
  });

  revalidatePath("/certified-housing-construction-credit");
  redirect(`/certified-housing-construction-credit?year=${year}&carryforwardSaved=1`);
}

/**
 * carryForwardCertifiedHousingConstructionCreditExcessで登録した繰越額
 * (CertifiedHousingConstructionCreditCarryforward)を、それを使える年分
 * (居住年の翌年)の CertifiedHousingConstructionCreditRecord.creditJpy に
 * 合算して登録する(既に当年分の登録がある場合はその金額に加算する)。1年限りの
 * 繰越のため、合算後は繰越データを削除する(消費済みとし、さらに翌年へは
 * 繰り越さない)。
 */
export async function applyCertifiedHousingConstructionCreditCarryforward(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await taxYearRepository.findByYear(year);
  const carryforward = taxYear
    ? await certifiedHousingConstructionCreditCarryforwardRepository.findByTaxYearId(taxYear.id)
    : null;

  if (taxYear && carryforward) {
    const existingRecord = await certifiedHousingConstructionCreditRecordRepository.findByTaxYearId(
      taxYear.id,
    );
    const combinedCreditJpy = new Decimal(existingRecord?.creditJpy.toString() ?? "0")
      .plus(carryforward.remainingAmountJpy.toString())
      .toString();

    await certifiedHousingConstructionCreditRecordRepository.upsert({
      taxYearId: taxYear.id,
      creditJpy: combinedCreditJpy,
    });
    await certifiedHousingConstructionCreditCarryforwardRepository.deleteByTaxYearId(taxYear.id);
  }

  revalidatePath("/tax-estimate");
  revalidatePath("/certified-housing-construction-credit");
  redirect(`/certified-housing-construction-credit?year=${year}&carryforwardApplied=1`);
}

/**
 * carryForwardCertifiedHousingConstructionCreditExcessで誤って登録した繰越額を
 * 取り消す(まだapplyCertifiedHousingConstructionCreditCarryforwardで消費して
 * いない場合のみ対象になる)。
 */
export async function deleteCertifiedHousingConstructionCreditCarryforward(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await certifiedHousingConstructionCreditCarryforwardRepository.deleteByTaxYearId(taxYear.id);
  }

  revalidatePath("/certified-housing-construction-credit");
  redirect(`/certified-housing-construction-credit?year=${year}&carryforwardDeleted=1`);
}

/**
 * 所得控除試算画面(医療費控除・生命保険料控除・小規模企業共済等掛金控除
 * (iDeCo等)・社会保険料控除)で試算した控除額を、その年分の IncomeDeduction
 * として登録する(区分ごとに1件。既に登録済みの場合は上書きする)。
 * ここに登録すると `/tax-estimate` の「給与所得等の課税所得金額」の
 * 初期値に自動反映される。
 */
export async function saveIncomeDeduction(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const type = requireString(formData, "type");
  if (!isIncomeDeductionType(type)) {
    throw new Error(`不正な所得控除区分です: ${type}`);
  }
  const incomeTaxAmountJpy = requireString(formData, "incomeTaxAmountJpy");
  const residentTaxAmountJpy = requireString(formData, "residentTaxAmountJpy");
  const redirectPath = requireString(formData, "redirectPath");

  const taxYear = await getOrCreateTaxYear(year);
  await incomeDeductionRepository.upsert({
    taxYearId: taxYear.id,
    type,
    incomeTaxAmountJpy,
    residentTaxAmountJpy,
  });

  revalidatePath("/tax-estimate");
  revalidatePath(redirectPath);
  redirect(`${redirectPath}?year=${year}&deductionSaved=${type}`);
}

/**
 * saveIncomeDeductionで登録した当年分・当区分のIncomeDeductionを削除する
 * (deleteMortgageDeductionRecordと同様の取り消し操作)。登録後に対象外になった、
 * または区分を間違えて登録した場合に、`/tax-estimate`の初期値・下書きCSVへの
 * 自動反映を止めるために使う。
 */
export async function deleteIncomeDeduction(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const type = requireString(formData, "type");
  if (!isIncomeDeductionType(type)) {
    throw new Error(`不正な所得控除区分です: ${type}`);
  }
  const redirectPath = requireString(formData, "redirectPath");

  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await incomeDeductionRepository.deleteByTaxYearIdAndType(taxYear.id, type);
  }

  revalidatePath("/tax-estimate");
  revalidatePath(redirectPath);
  redirect(`${redirectPath}?year=${year}&deductionDeleted=${type}`);
}

export async function saveMortgageDeductionRecord(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const nationalTaxCreditJpy = requireString(formData, "nationalTaxCreditJpy");
  const residentTaxCreditJpy = requireString(formData, "residentTaxCreditJpy");

  const taxYear = await getOrCreateTaxYear(year);
  await mortgageDeductionRecordRepository.upsert({
    taxYearId: taxYear.id,
    nationalTaxCreditJpy,
    residentTaxCreditJpy,
  });

  revalidatePath("/tax-estimate");
  revalidatePath("/mortgage-deduction");
  redirect(`/mortgage-deduction?year=${year}&mortgageDeductionSaved=1`);
}

/**
 * saveMortgageDeductionRecordで登録した当年分のMortgageDeductionRecordを削除する。
 * 登録後に住宅ローン控除の対象外になった(繰上完済・所得要件を満たさなくなった等)
 * 場合に、`/tax-estimate`・下書きCSVへの自動反映を止めるための取り消し操作。
 */
export async function deleteMortgageDeductionRecord(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await mortgageDeductionRecordRepository.deleteByTaxYearId(taxYear.id);
  }

  revalidatePath("/tax-estimate");
  revalidatePath("/mortgage-deduction");
  redirect(`/mortgage-deduction?year=${year}&mortgageDeductionDeleted=1`);
}

/**
 * 住民税の調整控除シミュレーター(/resident-tax-adjustment-deduction)の試算結果を
 * ResidentTaxAdjustmentDeductionRecord として登録する。住宅ローン控除
 * (saveMortgageDeductionRecord)・外国税額控除(saveForeignTaxCreditRecord)と同様、
 * `/tax-estimate`の合計税額試算(住民税所得割からの税額控除)への自動反映に使う。
 * 既に登録済みの場合は上書きする。
 */
export async function saveResidentTaxAdjustmentDeductionRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const adjustmentDeductionJpy = requireString(formData, "adjustmentDeductionJpy");

  const taxYear = await getOrCreateTaxYear(year);
  await residentTaxAdjustmentDeductionRecordRepository.upsert({
    taxYearId: taxYear.id,
    adjustmentDeductionJpy,
  });

  revalidatePath("/tax-estimate");
  revalidatePath("/resident-tax-adjustment-deduction");
  redirect(
    `/resident-tax-adjustment-deduction?year=${year}&residentTaxAdjustmentDeductionSaved=1`,
  );
}

/**
 * saveResidentTaxAdjustmentDeductionRecordで登録した当年分の
 * ResidentTaxAdjustmentDeductionRecordを削除する
 * (deleteMortgageDeductionRecordと同様の取り消し操作)。
 */
export async function deleteResidentTaxAdjustmentDeductionRecord(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await residentTaxAdjustmentDeductionRecordRepository.deleteByTaxYearId(taxYear.id);
  }

  revalidatePath("/tax-estimate");
  revalidatePath("/resident-tax-adjustment-deduction");
  redirect(
    `/resident-tax-adjustment-deduction?year=${year}&residentTaxAdjustmentDeductionDeleted=1`,
  );
}

/**
 * 給与所得の試算(/employment-income)で入力した給与収入金額をEmploymentIncomeRecordとして
 * 登録する。住民税の調整控除(saveResidentTaxAdjustmentDeductionRecord)等と同様、
 * `/tax-estimate`の「給与所得等の課税所得金額」の初期値への自動反映に使う。
 * 既に登録済みの場合は上書きする。
 */
export async function saveEmploymentIncomeRecord(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const grossSalaryJpy = requireString(formData, "grossSalaryJpy");

  const taxYear = await getOrCreateTaxYear(year);
  await employmentIncomeRecordRepository.upsert({
    taxYearId: taxYear.id,
    grossSalaryJpy,
  });

  revalidatePath("/tax-estimate");
  revalidatePath("/employment-income");
  redirect(`/employment-income?year=${year}&employmentIncomeSaved=1`);
}

/**
 * saveEmploymentIncomeRecordで登録した当年分のEmploymentIncomeRecordを削除する
 * (deleteResidentTaxAdjustmentDeductionRecordと同様の取り消し操作)。
 */
export async function deleteEmploymentIncomeRecord(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await employmentIncomeRecordRepository.deleteByTaxYearId(taxYear.id);
  }

  revalidatePath("/tax-estimate");
  revalidatePath("/employment-income");
  redirect(`/employment-income?year=${year}&employmentIncomeDeleted=1`);
}

export async function setCasualtyLossCarryforward(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const originYear = Number(requireString(formData, "originYear"));
  const remainingAmountJpy = requireString(formData, "remainingAmountJpy");

  const { redirectTo } = await setCasualtyLossCarryforwardCore(
    taxYearRepository,
    casualtyLossCarryforwardRepository,
    { year, originYear, remainingAmountJpy },
  );

  revalidatePath("/import");
  revalidatePath("/casualty-loss-deduction");
  redirect(redirectTo);
}

export async function deleteCasualtyLossCarryforward(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteCasualtyLossCarryforwardCore(
    casualtyLossCarryforwardRepository,
    { id, year },
  );

  revalidatePath("/import");
  revalidatePath("/casualty-loss-deduction");
  redirect(redirectTo);
}

/**
 * 雑損控除の試算画面(/casualty-loss-deduction)の当年分の計算結果のうち、
 * 翌年以後に繰り越す雑損失額(発生年ごと)を、翌年分の CasualtyLossCarryforward
 * としてまとめて登録する。外国税額控除の繰越(carryForwardForeignTaxCreditExcess)と
 * 同様、雑損控除の計算に必要な損害金額・総所得金額等はDBに保存されない都度入力の
 * ため、前年分をサーバー側で再計算することはできない。そのため、試算画面の計算結果を
 * 画面から直接この年の翌年分として保存する方式にしている(既に翌年分に同じ発生年の
 * 登録がある場合は上書きしない)。
 */
export async function carryForwardCasualtyLossExcess(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const entriesJson = requireString(formData, "carryforwardToNextYearJson");
  const entries = JSON.parse(entriesJson) as { originYear: number; remainingAmountJpy: string }[];

  const nextTaxYear = await getOrCreateTaxYear(year + 1);
  const existing = await casualtyLossCarryforwardRepository.findByTaxYearId(nextTaxYear.id);
  const existingYears = new Set(existing.map((e) => e.originYear));
  const toCreate = entries.filter((e) => !existingYears.has(e.originYear));

  await casualtyLossCarryforwardRepository.createMany(
    toCreate.map((e) => ({
      taxYearId: nextTaxYear.id,
      originYear: e.originYear,
      remainingAmountJpy: e.remainingAmountJpy,
    })),
  );

  revalidatePath("/import");
  redirect(`/casualty-loss-deduction?year=${year}&lossCarried=${toCreate.length}`);
}

export async function setHomeSaleLossCarryforward(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const originYear = Number(requireString(formData, "originYear"));
  const remainingAmountJpy = requireString(formData, "remainingAmountJpy");

  const { redirectTo } = await setHomeSaleLossCarryforwardCore(
    taxYearRepository,
    homeSaleLossCarryforwardRepository,
    { year, originYear, remainingAmountJpy },
  );

  revalidatePath("/import");
  revalidatePath("/home-sale-loss-deduction");
  redirect(redirectTo);
}

export async function deleteHomeSaleLossCarryforward(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteHomeSaleLossCarryforwardCore(
    homeSaleLossCarryforwardRepository,
    { id, year },
  );

  revalidatePath("/import");
  revalidatePath("/home-sale-loss-deduction");
  redirect(redirectTo);
}

/**
 * 特定居住用財産の譲渡損失の損益通算及び繰越控除の試算画面(/home-sale-loss-deduction)の
 * 当年分の計算結果のうち、翌年以後に繰り越す譲渡損失額(発生年ごと)を、翌年分の
 * HomeSaleLossCarryforwardとしてまとめて登録する。carryForwardCasualtyLossExcessと
 * 同様、試算に必要な譲渡価額・取得費・住宅借入金等残高・総所得金額等はDBに保存されない
 * 都度入力のため、前年分をサーバー側で再計算することはできない。そのため、試算画面の
 * 計算結果を画面から直接この年の翌年分として保存する方式にしている(既に翌年分に
 * 同じ発生年の登録がある場合は上書きしない)。
 */
export async function carryForwardHomeSaleLossExcess(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const entriesJson = requireString(formData, "carryforwardToNextYearJson");
  const entries = JSON.parse(entriesJson) as { originYear: number; remainingAmountJpy: string }[];

  const nextTaxYear = await getOrCreateTaxYear(year + 1);
  const existing = await homeSaleLossCarryforwardRepository.findByTaxYearId(nextTaxYear.id);
  const existingYears = new Set(existing.map((e) => e.originYear));
  const toCreate = entries.filter((e) => !existingYears.has(e.originYear));

  await homeSaleLossCarryforwardRepository.createMany(
    toCreate.map((e) => ({
      taxYearId: nextTaxYear.id,
      originYear: e.originYear,
      remainingAmountJpy: e.remainingAmountJpy,
    })),
  );

  revalidatePath("/import");
  redirect(`/home-sale-loss-deduction?year=${year}&lossCarried=${toCreate.length}`);
}

export async function setHomeReplacementLossCarryforward(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const originYear = Number(requireString(formData, "originYear"));
  const remainingAmountJpy = requireString(formData, "remainingAmountJpy");

  const { redirectTo } = await setHomeReplacementLossCarryforwardCore(
    taxYearRepository,
    homeReplacementLossCarryforwardRepository,
    { year, originYear, remainingAmountJpy },
  );

  revalidatePath("/import");
  revalidatePath("/home-replacement-loss-deduction");
  redirect(redirectTo);
}

export async function deleteHomeReplacementLossCarryforward(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteHomeReplacementLossCarryforwardCore(
    homeReplacementLossCarryforwardRepository,
    { id, year },
  );

  revalidatePath("/import");
  revalidatePath("/home-replacement-loss-deduction");
  redirect(redirectTo);
}

/**
 * 居住用財産の買換え等の場合の譲渡損失の損益通算及び繰越控除の試算画面
 * (/home-replacement-loss-deduction)の当年分の計算結果のうち、翌年以後に繰り越す
 * 譲渡損失額(発生年ごと)を、翌年分のHomeReplacementLossCarryforwardとしてまとめて
 * 登録する。carryForwardHomeSaleLossExcessと同様、試算に必要な譲渡価額・取得費・
 * 敷地面積・買換資産のデータ・総所得金額等はDBに保存されない都度入力のため、前年分を
 * サーバー側で再計算することはできない。そのため、試算画面の計算結果を画面から直接
 * この年の翌年分として保存する方式にしている(既に翌年分に同じ発生年の登録がある場合は
 * 上書きしない)。
 */
export async function carryForwardHomeReplacementLossExcess(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const entriesJson = requireString(formData, "carryforwardToNextYearJson");
  const entries = JSON.parse(entriesJson) as { originYear: number; remainingAmountJpy: string }[];

  const nextTaxYear = await getOrCreateTaxYear(year + 1);
  const existing =
    await homeReplacementLossCarryforwardRepository.findByTaxYearId(nextTaxYear.id);
  const existingYears = new Set(existing.map((e) => e.originYear));
  const toCreate = entries.filter((e) => !existingYears.has(e.originYear));

  await homeReplacementLossCarryforwardRepository.createMany(
    toCreate.map((e) => ({
      taxYearId: nextTaxYear.id,
      originYear: e.originYear,
      remainingAmountJpy: e.remainingAmountJpy,
    })),
  );

  revalidatePath("/import");
  redirect(`/home-replacement-loss-deduction?year=${year}&lossCarried=${toCreate.length}`);
}

/**
 * エンジェル税制の特定投資株式に係る譲渡損失の繰越控除(機能112)の残高を、
 * 発生年ごとに登録・更新する。`/angel-tax-loss-carryforward`の試算結果を見て
 * ユーザー自身が手入力する(他の繰越控除機能と異なり、この試算に必要な当年の
 * 特定株式の損失額・一般株式等の譲渡所得等の金額はDBに保存されないため、
 * 前年分の計算結果からの自動繰り越しには対応しない。詳細は
 * `src/lib/investment/angelTaxLossCarryforward.ts`のコメントを参照)。
 */
export async function setAngelTaxLossCarryforward(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const originYear = Number(requireString(formData, "originYear"));
  const remainingAmountJpy = requireString(formData, "remainingAmountJpy");

  const { redirectTo } = await setAngelTaxLossCarryforwardCore(
    taxYearRepository,
    angelTaxLossCarryforwardRepository,
    { year, originYear, remainingAmountJpy },
  );

  revalidatePath("/angel-tax-loss-carryforward");
  redirect(redirectTo);
}

export async function deleteAngelTaxLossCarryforward(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));

  const { redirectTo } = await deleteAngelTaxLossCarryforwardCore(
    angelTaxLossCarryforwardRepository,
    { id, year },
  );

  revalidatePath("/angel-tax-loss-carryforward");
  redirect(redirectTo);
}
