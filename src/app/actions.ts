"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseMoneyForwardCashflowCsv } from "@/lib/moneyforward/parseCashflow";
import { getOrCreateTaxYear } from "@/lib/taxYear";
import { buildYearReport } from "@/lib/reporting";
import {
  buildCryptoCarryForward,
  buildInvestmentCarryForward,
} from "@/lib/openingBalance";

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

export async function importMoneyForwardCsv(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("CSVファイルを選択してください");
  }

  const text = await file.text();
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

/**
 * 暗号資産の評価方法(総平均法/移動平均法)を年分ごとに切り替える。
 * 実務上、移動平均法を選択する場合は税務署への届出が必要な点に注意。
 */
export async function setCryptoValuationMethod(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const method = requireString(formData, "cryptoValuationMethod");
  if (method !== "TOTAL_AVERAGE" && method !== "MOVING_AVERAGE") {
    throw new Error("不正な評価方法です");
  }
  const taxYear = await getOrCreateTaxYear(year);

  await prisma.taxYear.update({
    where: { id: taxYear.id },
    data: { cryptoValuationMethod: method },
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=crypto`);
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

export async function deleteInvestmentTrade(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await prisma.investmentTrade.delete({ where: { id } });
  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=investment`);
}

export async function setCryptoOpeningBalance(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await getOrCreateTaxYear(year);
  const symbol = requireString(formData, "symbol").toUpperCase();

  await prisma.cryptoOpeningBalance.upsert({
    where: { taxYearId_symbol: { taxYearId: taxYear.id, symbol } },
    create: {
      taxYearId: taxYear.id,
      symbol,
      quantity: requireString(formData, "quantity"),
      costBasisJpy: requireString(formData, "costBasisJpy"),
    },
    update: {
      quantity: requireString(formData, "quantity"),
      costBasisJpy: requireString(formData, "costBasisJpy"),
    },
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=opening`);
}

export async function deleteCryptoOpeningBalance(formData: FormData): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await prisma.cryptoOpeningBalance.delete({ where: { id } });
  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=opening`);
}

export async function setInvestmentOpeningBalance(formData: FormData): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const taxYear = await getOrCreateTaxYear(year);
  const symbol = requireString(formData, "symbol");
  const isNisa = formData.get("isNisa") === "on";

  await prisma.investmentOpeningBalance.upsert({
    where: { taxYearId_symbol_isNisa: { taxYearId: taxYear.id, symbol, isNisa } },
    create: {
      taxYearId: taxYear.id,
      symbol,
      isNisa,
      quantity: requireString(formData, "quantity"),
      costBasisJpy: requireString(formData, "costBasisJpy"),
    },
    update: {
      quantity: requireString(formData, "quantity"),
      costBasisJpy: requireString(formData, "costBasisJpy"),
    },
  });

  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=opening`);
}

export async function deleteInvestmentOpeningBalance(
  formData: FormData,
): Promise<void> {
  const id = Number(requireString(formData, "id"));
  const year = Number(requireString(formData, "year"));
  await prisma.investmentOpeningBalance.delete({ where: { id } });
  revalidatePath("/import");
  revalidatePath("/");
  redirect(`/import?year=${year}&tab=opening`);
}

/**
 * 前年分の期末残高(その年の取引を全て計算した結果の残り)を、
 * 当年分の期首残高として一括登録する。既存の当年分期首残高は上書きする。
 */
export async function carryForwardOpeningBalances(
  formData: FormData,
): Promise<void> {
  const year = Number(requireString(formData, "year"));
  const previousYearReport = await buildYearReport(year - 1);

  if (!previousYearReport) {
    redirect(`/import?year=${year}&tab=opening`);
  }

  const taxYear = await getOrCreateTaxYear(year);
  const cryptoRows = buildCryptoCarryForward(previousYearReport.crypto);
  const investmentRows = buildInvestmentCarryForward(previousYearReport.investment);

  await prisma.$transaction([
    ...cryptoRows.map((row) =>
      prisma.cryptoOpeningBalance.upsert({
        where: { taxYearId_symbol: { taxYearId: taxYear.id, symbol: row.symbol } },
        create: {
          taxYearId: taxYear.id,
          symbol: row.symbol,
          quantity: row.quantity.toString(),
          costBasisJpy: row.costBasisJpy.toString(),
        },
        update: {
          quantity: row.quantity.toString(),
          costBasisJpy: row.costBasisJpy.toString(),
        },
      }),
    ),
    ...investmentRows.map((row) =>
      prisma.investmentOpeningBalance.upsert({
        where: {
          taxYearId_symbol_isNisa: {
            taxYearId: taxYear.id,
            symbol: row.symbol,
            isNisa: row.isNisa,
          },
        },
        create: {
          taxYearId: taxYear.id,
          symbol: row.symbol,
          isNisa: row.isNisa,
          quantity: row.quantity.toString(),
          costBasisJpy: row.costBasisJpy.toString(),
        },
        update: {
          quantity: row.quantity.toString(),
          costBasisJpy: row.costBasisJpy.toString(),
        },
      }),
    ),
  ]);

  revalidatePath("/import");
  revalidatePath("/");
  redirect(
    `/import?year=${year}&tab=opening&carried=${cryptoRows.length + investmentRows.length}`,
  );
}
