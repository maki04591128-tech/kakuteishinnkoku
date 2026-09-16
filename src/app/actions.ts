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

  await prisma.investmentTrade.create({
    data: {
      taxYearId: taxYear.id,
      tradedAt: new Date(requireString(formData, "tradedAt")),
      symbol: requireString(formData, "symbol"),
      name: optionalString(formData, "name"),
      assetType: requireString(formData, "assetType") as never,
      type: requireString(formData, "type") as never,
      quantity: requireString(formData, "quantity"),
      unitPriceJpy: requireString(formData, "unitPriceJpy"),
      feeJpy: optionalString(formData, "feeJpy") ?? "0",
      accountType: requireString(formData, "accountType") as never,
      isNisa: formData.get("isNisa") === "on",
      nisaType: optionalString(formData, "nisaType") as never,
      isForeign: formData.get("isForeign") === "on",
      foreignTaxWithheldJpy: optionalString(formData, "foreignTaxWithheldJpy") ?? "0",
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
  // NISA口座は投資のみ区分がある。暗号資産では常にfalseとして扱う。
  const isNisa = assetClass === "INVESTMENT" && formData.get("isNisa") === "on";
  const quantity = requireString(formData, "quantity");
  const costBasisJpy = requireString(formData, "costBasisJpy");

  await prisma.openingBalance.upsert({
    where: {
      taxYearId_assetClass_symbol_isNisa: {
        taxYearId: taxYear.id,
        assetClass,
        symbol,
        isNisa,
      },
    },
    create: {
      taxYearId: taxYear.id,
      assetClass,
      symbol,
      isNisa,
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
    select: { assetClass: true, symbol: true, isNisa: true },
  });
  const existingKeys = new Set(
    existing.map((e) => `${e.assetClass}:${e.symbol}:${e.isNisa}`),
  );

  const toCreate = candidates.filter(
    (c) => !existingKeys.has(`${c.assetClass}:${c.symbol}:${c.isNisa}`),
  );

  if (toCreate.length > 0) {
    await prisma.openingBalance.createMany({
      data: toCreate.map((c) => ({
        taxYearId: taxYear.id,
        assetClass: c.assetClass,
        symbol: c.symbol,
        isNisa: c.isNisa,
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
