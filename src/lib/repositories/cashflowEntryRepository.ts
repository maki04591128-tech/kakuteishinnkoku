/**
 * フェーズ1(リポジトリパターン導入): `src/app/actions.ts`の
 * `importMoneyForwardCsv`が直接`prisma.$transaction`で`prisma.importBatch`/
 * `prisma.cashflowEntry`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる(ImportBatchの作成と
 * CashflowEntryの一括登録を1つのトランザクションで行う点も含む)。
 */
import type { CashflowDirection } from "@prisma/client";
import { prisma } from "../db";

export interface CashflowEntryImportRow {
  date: Date;
  content: string;
  amountJpy: string;
  direction: CashflowDirection;
  largeCategory: string | null;
  middleCategory: string | null;
  institution: string | null;
  memo: string | null;
  isCalculationTarget: boolean;
}

export interface CashflowEntryRepository {
  importMoneyForwardCsv(input: {
    taxYearId: number;
    fileName: string;
    rows: CashflowEntryImportRow[];
  }): Promise<void>;
}

export function createPrismaCashflowEntryRepository(): CashflowEntryRepository {
  return {
    async importMoneyForwardCsv({ taxYearId, fileName, rows }): Promise<void> {
      await prisma.$transaction(async (tx) => {
        const batch = await tx.importBatch.create({
          data: {
            taxYearId,
            sourceType: "moneyforward_cashflow",
            fileName,
            rowCount: rows.length,
          },
        });

        if (rows.length > 0) {
          await tx.cashflowEntry.createMany({
            data: rows.map((row) => ({
              importBatchId: batch.id,
              date: row.date,
              content: row.content,
              amountJpy: row.amountJpy,
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
    },
  };
}
