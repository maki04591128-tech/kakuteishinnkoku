/**
 * フェーズ1(リポジトリパターン導入): `src/app/actions.ts`の
 * `importMoneyForwardCsv`が直接`prisma.$transaction`で`prisma.importBatch`/
 * `prisma.cashflowEntry`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる(ImportBatchの作成と
 * CashflowEntryの一括登録を1つのトランザクションで行う点も含む)。
 * フェーズ2-33でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientCashflowEntryRepository`。wa-sqlite)を追加した。
 */
import type { CashflowDirection } from "@prisma/client";
import { prisma } from "../db";
import type { ClientDb } from "../clientDb/sqlite";

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

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-33)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientCashflowEntryRepository(
  db: ClientDb,
): CashflowEntryRepository {
  return {
    async importMoneyForwardCsv({
      taxYearId,
      fileName,
      rows,
    }): Promise<void> {
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO import_batch (tax_year_id, source_type, file_name, imported_at, row_count)
         VALUES (?, ?, ?, ?, ?)`,
        [taxYearId, "moneyforward_cashflow", fileName, now, rows.length],
      );
      const [{ id: rawBatchId }] = await db.all(
        `SELECT last_insert_rowid() AS id`,
      );
      const batchId = Number(rawBatchId);

      for (const row of rows) {
        await db.run(
          `INSERT INTO cashflow_entry
             (import_batch_id, date, content, amount_jpy, direction,
              large_category, middle_category, institution, memo,
              is_calculation_target, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            batchId,
            row.date.toISOString(),
            row.content,
            row.amountJpy,
            row.direction,
            row.largeCategory,
            row.middleCategory,
            row.institution,
            row.memo,
            row.isCalculationTarget ? 1 : 0,
            now,
          ],
        );
      }
    },
  };
}
