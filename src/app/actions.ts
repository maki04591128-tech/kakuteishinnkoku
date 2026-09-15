"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseMoneyForwardCashflowCsv } from "@/lib/moneyforward/parseCashflow";
import { getOrCreateTaxYear } from "@/lib/taxYear";
import { buildCarryForwardCandidates } from "@/lib/reporting";

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
