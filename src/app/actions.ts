"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
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

export async function setCryptoCostMethod(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const method = requireString(formData, "cryptoCostMethod");
  const tab = optionalString(formData, "tab");
  if (method !== "AVERAGE" && method !== "MOVING_AVERAGE") {
    throw new Error(`未対応の評価方法です: ${method}`);
  }
  const taxYear = await getOrCreateTaxYear(year);

  await prisma.taxYear.update({
    where: { id: taxYear.id },
    data: { cryptoCostMethod: method },
  });

  revalidatePath("/import");
  revalidatePath("/");
  if (tab) {
    redirect(`/import?year=${year}&tab=${tab}`);
  }
  redirect(`/?year=${year}`);
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

  await prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        taxYearId: taxYear.id,
        sourceType: "moneyforward_cashflow",
        fileName: file.name,
        rowCount: rows.length,
      },
    });

    if (rows.length > 0) {
      await tx.cashflowEntry.createMany({
        data: rows.map((row) => ({
          importBatchId: batch.id,
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
    }
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

  await prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        taxYearId: taxYear.id,
        sourceType: `crypto_csv_${preset}`,
        fileName: file.name,
        rowCount: rows.length,
      },
    });

    if (rows.length > 0) {
      await tx.cryptoTrade.createMany({
        data: rows.map((row) => ({
          taxYearId: taxYear.id,
          tradedAt: row.tradedAt,
          symbol: row.symbol,
          type: row.type as never,
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
          importBatchId: batch.id,
        })),
      });
    }
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

  await prisma.cryptoTrade.create({
    data: {
      taxYearId: taxYear.id,
      tradedAt: new Date(requireString(formData, "tradedAt")),
      symbol: requireString(formData, "symbol").toUpperCase(),
      type: requireString(formData, "type") as never,
      quantity: requireString(formData, "quantity"),
      unitPriceJpy: requireString(formData, "unitPriceJpy"),
      feeJpy: optionalString(formData, "feeJpy") ?? "0",
      exchange: optionalString(formData, "exchange"),
      memo: optionalString(formData, "memo"),
      source: "manual",
    },
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

  await prisma.investmentTrade.create({
    data: {
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
    },
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=investment`);
}

export async function deleteCryptoTrade(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await prisma.cryptoTrade.delete({ where: { id } });
  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=crypto`);
}

export async function addCryptoMarginTrade(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await getOrCreateTaxYear(year);

  await prisma.cryptoMarginTrade.create({
    data: {
      taxYearId: taxYear.id,
      settledAt: new Date(requireString(formData, "settledAt")),
      symbol: requireString(formData, "symbol").toUpperCase(),
      realizedPnlJpy: requireString(formData, "realizedPnlJpy"),
      feeJpy: optionalString(formData, "feeJpy") ?? "0",
      swapJpy: optionalString(formData, "swapJpy") ?? "0",
      exchange: optionalString(formData, "exchange"),
      memo: optionalString(formData, "memo"),
      source: "manual",
    },
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=cryptoMargin`);
}

export async function deleteCryptoMarginTrade(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await prisma.cryptoMarginTrade.delete({ where: { id } });
  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=cryptoMargin`);
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

  await prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        taxYearId: taxYear.id,
        sourceType: "crypto_margin_csv",
        fileName: file.name,
        rowCount: rows.length,
      },
    });

    if (rows.length > 0) {
      await tx.cryptoMarginTrade.createMany({
        data: rows.map((row) => ({
          taxYearId: taxYear.id,
          settledAt: row.settledAt,
          symbol: row.symbol,
          realizedPnlJpy: row.realizedPnlJpy.toString(),
          feeJpy: row.feeJpy.toString(),
          swapJpy: row.swapJpy.toString(),
          exchange: exchangeLabel,
          source: "crypto_margin_csv:manual",
          importBatchId: batch.id,
        })),
      });
    }
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
  await prisma.investmentTrade.delete({ where: { id } });
  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=investment`);
}

export async function addFuturesTrade(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await getOrCreateTaxYear(year);

  await prisma.futuresTrade.create({
    data: {
      taxYearId: taxYear.id,
      settledAt: new Date(requireString(formData, "settledAt")),
      symbol: requireString(formData, "symbol"),
      realizedPnlJpy: requireString(formData, "realizedPnlJpy"),
      feeJpy: optionalString(formData, "feeJpy") ?? "0",
      swapJpy: optionalString(formData, "swapJpy") ?? "0",
      broker: optionalString(formData, "broker"),
      memo: optionalString(formData, "memo"),
      source: "manual",
    },
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=futures`);
}

export async function deleteFuturesTrade(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await prisma.futuresTrade.delete({ where: { id } });
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

  await prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        taxYearId: taxYear.id,
        sourceType: "futures_csv",
        fileName: file.name,
        rowCount: rows.length,
      },
    });

    if (rows.length > 0) {
      await tx.futuresTrade.createMany({
        data: rows.map((row) => ({
          taxYearId: taxYear.id,
          settledAt: row.settledAt,
          symbol: row.symbol,
          realizedPnlJpy: row.realizedPnlJpy.toString(),
          feeJpy: row.feeJpy.toString(),
          swapJpy: row.swapJpy.toString(),
          broker: brokerLabel,
          source: "futures_csv:manual",
          importBatchId: batch.id,
        })),
      });
    }
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
  if (!Number.isInteger(originYear) || originYear > year) {
    throw new Error("損失の発生年は対象年分以前の年である必要があります");
  }
  const taxYear = await getOrCreateTaxYear(year);

  await prisma.futuresLossCarryforward.upsert({
    where: {
      taxYearId_originYear: { taxYearId: taxYear.id, originYear },
    },
    create: { taxYearId: taxYear.id, originYear, remainingAmountJpy },
    update: { remainingAmountJpy },
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=futuresLossCarryforward`);
}

export async function deleteFuturesLossCarryforward(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await prisma.futuresLossCarryforward.delete({ where: { id } });
  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=futuresLossCarryforward`);
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

  const existing = await prisma.futuresLossCarryforward.findMany({
    where: { taxYearId: taxYear.id },
    select: { originYear: true },
  });
  const existingYears = new Set(existing.map((e) => e.originYear));

  const toCreate = candidates.filter((c) => !existingYears.has(c.originYear));

  if (toCreate.length > 0) {
    await prisma.futuresLossCarryforward.createMany({
      data: toCreate.map((c) => ({
        taxYearId: taxYear.id,
        originYear: c.originYear,
        remainingAmountJpy: c.remainingAmountJpy.toString(),
      })),
    });
  }

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

  await prisma.brokerAnnualReport.upsert({
    where: {
      taxYearId_broker_accountType: {
        taxYearId: taxYear.id,
        broker,
        accountType: accountType as never,
      },
    },
    create: {
      taxYearId: taxYear.id,
      broker,
      accountType: accountType as never,
      proceedsJpy,
      acquisitionCostJpy,
      dividendJpy,
    },
    update: { proceedsJpy, acquisitionCostJpy, dividendJpy },
  });

  revalidatePath("/import");
  redirect(`/import?year=${year}&tab=brokerReport`);
}

export async function deleteBrokerAnnualReport(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await prisma.brokerAnnualReport.delete({ where: { id } });
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

  await prisma.$transaction(
    rows.map((row) =>
      prisma.brokerAnnualReport.upsert({
        where: {
          taxYearId_broker_accountType: {
            taxYearId: taxYear.id,
            broker: row.broker,
            accountType: row.accountType,
          },
        },
        create: {
          taxYearId: taxYear.id,
          broker: row.broker,
          accountType: row.accountType,
          proceedsJpy: row.proceedsJpy.toString(),
          acquisitionCostJpy: row.acquisitionCostJpy.toString(),
          dividendJpy: row.dividendJpy.toString(),
        },
        update: {
          proceedsJpy: row.proceedsJpy.toString(),
          acquisitionCostJpy: row.acquisitionCostJpy.toString(),
          dividendJpy: row.dividendJpy.toString(),
        },
      }),
    ),
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

  await prisma.openingBalance.upsert({
    where: {
      taxYearId_assetClass_symbol_isNisa_isListed: {
        taxYearId: taxYear.id,
        assetClass,
        symbol,
        isNisa,
        isListed,
      },
    },
    create: {
      taxYearId: taxYear.id,
      assetClass,
      symbol,
      isNisa,
      isListed,
      quantity,
      costBasisJpy,
    },
    update: { quantity, costBasisJpy },
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=opening`);
}

export async function deleteOpeningBalance(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await prisma.openingBalance.delete({ where: { id } });
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

  await prisma.openingBalanceByInstitution.upsert({
    where: {
      taxYearId_assetClass_symbol_institution: {
        taxYearId: taxYear.id,
        assetClass,
        symbol,
        institution,
      },
    },
    create: {
      taxYearId: taxYear.id,
      assetClass,
      symbol,
      institution,
      quantity,
    },
    update: { quantity },
  });

  revalidatePath("/import");
  redirect(`/import?year=${year}&tab=assetBalance`);
}

export async function deleteOpeningBalanceByInstitution(
  formData: FormData,
): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await prisma.openingBalanceByInstitution.delete({ where: { id } });
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

  const existing = await prisma.openingBalance.findMany({
    where: { taxYearId: taxYear.id },
    select: { assetClass: true, symbol: true, isNisa: true, isListed: true },
  });
  const existingKeys = new Set(
    existing.map((e) => `${e.assetClass}:${e.symbol}:${e.isNisa}:${e.isListed}`),
  );

  const toCreate = candidates.filter(
    (c) => !existingKeys.has(`${c.assetClass}:${c.symbol}:${c.isNisa}:${c.isListed}`),
  );

  if (toCreate.length > 0) {
    await prisma.openingBalance.createMany({
      data: toCreate.map((c) => ({
        taxYearId: taxYear.id,
        assetClass: c.assetClass,
        symbol: c.symbol,
        isNisa: c.isNisa,
        isListed: c.isListed,
        quantity: c.quantity,
        costBasisJpy: c.costBasisJpy,
      })),
    });
  }

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

  await prisma.investmentLossCarryforward.upsert({
    where: {
      taxYearId_originYear: { taxYearId: taxYear.id, originYear },
    },
    create: { taxYearId: taxYear.id, originYear, remainingAmountJpy },
    update: { remainingAmountJpy },
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=lossCarryforward`);
}

export async function deleteLossCarryforward(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await prisma.investmentLossCarryforward.delete({ where: { id } });
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

  const existing = await prisma.investmentLossCarryforward.findMany({
    where: { taxYearId: taxYear.id },
    select: { originYear: true },
  });
  const existingYears = new Set(existing.map((e) => e.originYear));

  const toCreate = candidates.filter((c) => !existingYears.has(c.originYear));

  if (toCreate.length > 0) {
    await prisma.investmentLossCarryforward.createMany({
      data: toCreate.map((c) => ({
        taxYearId: taxYear.id,
        originYear: c.originYear,
        remainingAmountJpy: c.remainingAmountJpy.toString(),
      })),
    });
  }

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

  await prisma.nisaLifetimeQuota.upsert({
    where: {
      taxYearId_nisaType: { taxYearId: taxYear.id, nisaType },
    },
    create: { taxYearId: taxYear.id, nisaType, openingUsedJpy, soldCostBasisJpy },
    update: { openingUsedJpy, soldCostBasisJpy },
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=nisaLifetime`);
}

export async function deleteNisaLifetimeQuota(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await prisma.nisaLifetimeQuota.delete({ where: { id } });
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

  const existing = await prisma.nisaLifetimeQuota.findMany({
    where: { taxYearId: taxYear.id },
    select: { nisaType: true },
  });
  const existingTypes = new Set(existing.map((e) => e.nisaType));

  const toCreate = candidates.filter((c) => !existingTypes.has(c.nisaType));

  if (toCreate.length > 0) {
    await prisma.nisaLifetimeQuota.createMany({
      data: toCreate.map((c) => ({
        taxYearId: taxYear.id,
        nisaType: c.nisaType,
        openingUsedJpy: c.openingUsedJpy,
      })),
    });
  }

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

  await prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        taxYearId: taxYear.id,
        sourceType: "moneyforward_assets",
        fileName: file.name,
        rowCount: rows.length,
      },
    });

    if (rows.length > 0) {
      await tx.assetBalanceSnapshot.createMany({
        data: rows.map((row) => ({
          taxYearId: taxYear.id,
          ...(row.snapshotDate ? { snapshotDate: row.snapshotDate } : {}),
          category: row.category,
          institution: row.institution,
          assetName: row.assetName,
          balanceJpy: row.balanceJpy.toString(),
          quantity: row.quantity ? row.quantity.toString() : null,
          importBatchId: batch.id,
        })),
      });
    }
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
  await prisma.$transaction([
    prisma.assetBalanceSnapshot.deleteMany({ where: { importBatchId } }),
    prisma.importBatch.delete({ where: { id: importBatchId } }),
  ]);
  revalidatePath("/import");
  redirect(`/import?year=${year}&tab=assetBalance`);
}

/**
 * マネーフォワードの資産名(例:「ビットコイン」)とアプリの銘柄シンボル
 * (例:「BTC」)の対応を登録する。年に紐付かない全年共通のマスタデータ。
 */
export async function setAssetSymbolMapping(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const assetName = requireString(formData, "assetName").trim();
  const symbol = requireString(formData, "symbol").trim().toUpperCase();

  await prisma.assetSymbolMapping.upsert({
    where: { assetName },
    create: { assetName, symbol },
    update: { symbol },
  });

  revalidatePath("/import");
  redirect(`/import?year=${year}&tab=assetBalance`);
}

export async function deleteAssetSymbolMapping(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await prisma.assetSymbolMapping.delete({ where: { id } });
  revalidatePath("/import");
  redirect(`/import?year=${year}&tab=assetBalance`);
}

/**
 * 銘柄の現在価格(時価)を手入力で登録する。自動取得の仕組みは持たず、年に
 * 紐付かない全年共通のマスタデータ。`/unrealized-gain`の現在価格欄の初期値と、
 * マネーフォワード資産残高突合の評価額比較(valueCheck)の両方で参照する。
 */
export async function setMarketPrice(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const symbol = requireString(formData, "symbol").trim().toUpperCase();
  const priceJpy = requireString(formData, "priceJpy").trim();

  await prisma.marketPrice.upsert({
    where: { symbol },
    create: { symbol, priceJpy },
    update: { priceJpy },
  });

  revalidatePath("/import");
  revalidatePath("/unrealized-gain");
  redirect(`/import?year=${year}&tab=assetBalance`);
}

export async function deleteMarketPrice(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await prisma.marketPrice.delete({ where: { id } });
  revalidatePath("/import");
  revalidatePath("/unrealized-gain");
  redirect(`/import?year=${year}&tab=assetBalance`);
}

export async function setForeignTaxCreditCarryforward(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const originYear = Number(requireString(formData, "originYear"));
  const remainingAmountJpy = requireString(formData, "remainingAmountJpy");
  if (!Number.isInteger(originYear) || originYear > year) {
    throw new Error("控除限度超過額の発生年は対象年分以前の年である必要があります");
  }
  const taxYear = await getOrCreateTaxYear(year);

  await prisma.foreignTaxCreditCarryforward.upsert({
    where: {
      taxYearId_originYear: { taxYearId: taxYear.id, originYear },
    },
    create: { taxYearId: taxYear.id, originYear, remainingAmountJpy },
    update: { remainingAmountJpy },
  });

  revalidatePath("/import");
  redirect(`/import?year=${year}&tab=foreignTaxCredit`);
}

export async function deleteForeignTaxCreditCarryforward(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await prisma.foreignTaxCreditCarryforward.delete({ where: { id } });
  revalidatePath("/import");
  redirect(`/import?year=${year}&tab=foreignTaxCredit`);
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
  const existing = await prisma.foreignTaxCreditCarryforward.findMany({
    where: { taxYearId: nextTaxYear.id },
    select: { originYear: true },
  });
  const existingYears = new Set(existing.map((e) => e.originYear));
  const toCreate = entries.filter((e) => !existingYears.has(e.originYear));

  if (toCreate.length > 0) {
    await prisma.foreignTaxCreditCarryforward.createMany({
      data: toCreate.map((e) => ({
        taxYearId: nextTaxYear.id,
        originYear: e.originYear,
        remainingAmountJpy: e.remainingAmountJpy,
      })),
    });
  }

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
  if (!Number.isInteger(originYear) || originYear > year) {
    throw new Error("控除余裕額の発生年は対象年分以前の年である必要があります");
  }
  const taxYear = await getOrCreateTaxYear(year);

  await prisma.foreignTaxCreditSpareLimitCarryforward.upsert({
    where: {
      taxYearId_originYear: { taxYearId: taxYear.id, originYear },
    },
    create: { taxYearId: taxYear.id, originYear, remainingAmountJpy },
    update: { remainingAmountJpy },
  });

  revalidatePath("/import");
  redirect(`/import?year=${year}&tab=foreignTaxCredit`);
}

export async function deleteForeignTaxCreditSpareLimitCarryforward(
  formData: FormData,
): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await prisma.foreignTaxCreditSpareLimitCarryforward.delete({ where: { id } });
  revalidatePath("/import");
  redirect(`/import?year=${year}&tab=foreignTaxCredit`);
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
  const existing = await prisma.foreignTaxCreditSpareLimitCarryforward.findMany({
    where: { taxYearId: nextTaxYear.id },
    select: { originYear: true },
  });
  const existingYears = new Set(existing.map((e) => e.originYear));
  const toCreate = entries.filter((e) => !existingYears.has(e.originYear));

  if (toCreate.length > 0) {
    await prisma.foreignTaxCreditSpareLimitCarryforward.createMany({
      data: toCreate.map((e) => ({
        taxYearId: nextTaxYear.id,
        originYear: e.originYear,
        remainingAmountJpy: e.remainingAmountJpy,
      })),
    });
  }

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
  await prisma.foreignTaxCreditRecord.upsert({
    where: { taxYearId: taxYear.id },
    create: { taxYearId: taxYear.id, totalCreditJpy, nationalTaxCreditJpy, residentTaxCreditJpy },
    update: { totalCreditJpy, nationalTaxCreditJpy, residentTaxCreditJpy },
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
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (taxYear) {
    await prisma.foreignTaxCreditRecord.deleteMany({ where: { taxYearId: taxYear.id } });
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
  await prisma.donationTaxCreditRecord.upsert({
    where: { taxYearId: taxYear.id },
    create: { taxYearId: taxYear.id, totalTaxCreditJpy, residentTaxBasicDeductionJpy },
    update: { totalTaxCreditJpy, residentTaxBasicDeductionJpy },
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
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (taxYear) {
    await prisma.donationTaxCreditRecord.deleteMany({ where: { taxYearId: taxYear.id } });
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
  await prisma.distributionAdjustedForeignTaxCreditRecord.upsert({
    where: { taxYearId: taxYear.id },
    create: { taxYearId: taxYear.id, creditJpy },
    update: { creditJpy },
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
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (taxYear) {
    await prisma.distributionAdjustedForeignTaxCreditRecord.deleteMany({
      where: { taxYearId: taxYear.id },
    });
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

  const taxYear = await getOrCreateTaxYear(year);
  await prisma.earthquakeRenovationDeductionRecord.upsert({
    where: { taxYearId: taxYear.id },
    create: { taxYearId: taxYear.id, creditJpy },
    update: { creditJpy },
  });

  revalidatePath("/tax-estimate");
  revalidatePath("/earthquake-renovation-deduction");
  redirect(`/earthquake-renovation-deduction?year=${year}&saved=1`);
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
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (taxYear) {
    await prisma.earthquakeRenovationDeductionRecord.deleteMany({
      where: { taxYearId: taxYear.id },
    });
  }

  revalidatePath("/tax-estimate");
  revalidatePath("/earthquake-renovation-deduction");
  redirect(`/earthquake-renovation-deduction?year=${year}&deleted=1`);
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

  const taxYear = await getOrCreateTaxYear(year);
  await prisma.energySavingRenovationDeductionRecord.upsert({
    where: { taxYearId: taxYear.id },
    create: { taxYearId: taxYear.id, creditJpy },
    update: { creditJpy },
  });

  revalidatePath("/tax-estimate");
  revalidatePath("/energy-saving-renovation-deduction");
  redirect(`/energy-saving-renovation-deduction?year=${year}&saved=1`);
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
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (taxYear) {
    await prisma.energySavingRenovationDeductionRecord.deleteMany({
      where: { taxYearId: taxYear.id },
    });
  }

  revalidatePath("/tax-estimate");
  revalidatePath("/energy-saving-renovation-deduction");
  redirect(`/energy-saving-renovation-deduction?year=${year}&deleted=1`);
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

  const taxYear = await getOrCreateTaxYear(year);
  await prisma.barrierFreeRenovationDeductionRecord.upsert({
    where: { taxYearId: taxYear.id },
    create: { taxYearId: taxYear.id, creditJpy },
    update: { creditJpy },
  });

  revalidatePath("/tax-estimate");
  revalidatePath("/barrier-free-renovation-deduction");
  redirect(`/barrier-free-renovation-deduction?year=${year}&saved=1`);
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
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (taxYear) {
    await prisma.barrierFreeRenovationDeductionRecord.deleteMany({
      where: { taxYearId: taxYear.id },
    });
  }

  revalidatePath("/tax-estimate");
  revalidatePath("/barrier-free-renovation-deduction");
  redirect(`/barrier-free-renovation-deduction?year=${year}&deleted=1`);
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

  const taxYear = await getOrCreateTaxYear(year);
  await prisma.multiHouseholdRenovationDeductionRecord.upsert({
    where: { taxYearId: taxYear.id },
    create: { taxYearId: taxYear.id, creditJpy },
    update: { creditJpy },
  });

  revalidatePath("/tax-estimate");
  revalidatePath("/multi-household-renovation-deduction");
  redirect(`/multi-household-renovation-deduction?year=${year}&saved=1`);
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
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (taxYear) {
    await prisma.multiHouseholdRenovationDeductionRecord.deleteMany({
      where: { taxYearId: taxYear.id },
    });
  }

  revalidatePath("/tax-estimate");
  revalidatePath("/multi-household-renovation-deduction");
  redirect(`/multi-household-renovation-deduction?year=${year}&deleted=1`);
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
  await prisma.durabilityImprovementRenovationDeductionRecord.upsert({
    where: { taxYearId: taxYear.id },
    create: { taxYearId: taxYear.id, creditJpy },
    update: { creditJpy },
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
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (taxYear) {
    await prisma.durabilityImprovementRenovationDeductionRecord.deleteMany({
      where: { taxYearId: taxYear.id },
    });
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
  await prisma.childRearingRenovationDeductionRecord.upsert({
    where: { taxYearId: taxYear.id },
    create: { taxYearId: taxYear.id, creditJpy },
    update: { creditJpy },
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
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (taxYear) {
    await prisma.childRearingRenovationDeductionRecord.deleteMany({
      where: { taxYearId: taxYear.id },
    });
  }

  revalidatePath("/tax-estimate");
  revalidatePath("/child-rearing-renovation-deduction");
  redirect(`/child-rearing-renovation-deduction?year=${year}&deleted=1`);
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
  await prisma.incomeDeduction.upsert({
    where: { taxYearId_type: { taxYearId: taxYear.id, type } },
    create: { taxYearId: taxYear.id, type, incomeTaxAmountJpy, residentTaxAmountJpy },
    update: { incomeTaxAmountJpy, residentTaxAmountJpy },
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

  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (taxYear) {
    await prisma.incomeDeduction.deleteMany({ where: { taxYearId: taxYear.id, type } });
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
  await prisma.mortgageDeductionRecord.upsert({
    where: { taxYearId: taxYear.id },
    create: { taxYearId: taxYear.id, nationalTaxCreditJpy, residentTaxCreditJpy },
    update: { nationalTaxCreditJpy, residentTaxCreditJpy },
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
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (taxYear) {
    await prisma.mortgageDeductionRecord.deleteMany({ where: { taxYearId: taxYear.id } });
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
  await prisma.residentTaxAdjustmentDeductionRecord.upsert({
    where: { taxYearId: taxYear.id },
    create: { taxYearId: taxYear.id, adjustmentDeductionJpy },
    update: { adjustmentDeductionJpy },
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
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (taxYear) {
    await prisma.residentTaxAdjustmentDeductionRecord.deleteMany({
      where: { taxYearId: taxYear.id },
    });
  }

  revalidatePath("/tax-estimate");
  revalidatePath("/resident-tax-adjustment-deduction");
  redirect(
    `/resident-tax-adjustment-deduction?year=${year}&residentTaxAdjustmentDeductionDeleted=1`,
  );
}

export async function setCasualtyLossCarryforward(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const originYear = Number(requireString(formData, "originYear"));
  const remainingAmountJpy = requireString(formData, "remainingAmountJpy");
  if (!Number.isInteger(originYear) || originYear > year) {
    throw new Error("雑損失の発生年は対象年分以前の年である必要があります");
  }
  const taxYear = await getOrCreateTaxYear(year);

  await prisma.casualtyLossCarryforward.upsert({
    where: {
      taxYearId_originYear: { taxYearId: taxYear.id, originYear },
    },
    create: { taxYearId: taxYear.id, originYear, remainingAmountJpy },
    update: { remainingAmountJpy },
  });

  revalidatePath("/import");
  revalidatePath("/casualty-loss-deduction");
  redirect(`/import?year=${year}&tab=casualtyLossCarryforward`);
}

export async function deleteCasualtyLossCarryforward(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await prisma.casualtyLossCarryforward.delete({ where: { id } });
  revalidatePath("/import");
  revalidatePath("/casualty-loss-deduction");
  redirect(`/import?year=${year}&tab=casualtyLossCarryforward`);
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
  const existing = await prisma.casualtyLossCarryforward.findMany({
    where: { taxYearId: nextTaxYear.id },
    select: { originYear: true },
  });
  const existingYears = new Set(existing.map((e) => e.originYear));
  const toCreate = entries.filter((e) => !existingYears.has(e.originYear));

  if (toCreate.length > 0) {
    await prisma.casualtyLossCarryforward.createMany({
      data: toCreate.map((e) => ({
        taxYearId: nextTaxYear.id,
        originYear: e.originYear,
        remainingAmountJpy: e.remainingAmountJpy,
      })),
    });
  }

  revalidatePath("/import");
  redirect(`/casualty-loss-deduction?year=${year}&lossCarried=${toCreate.length}`);
}
