/**
 * フェーズ1(リポジトリパターン導入): `src/lib/residentTaxAdjustmentDeduction.ts`が
 * 直接`prisma.residentTaxAdjustmentDeductionRecord`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-22でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientResidentTaxAdjustmentDeductionRecordRepository`。wa-sqlite)を追加した。
 */
import { Prisma, type ResidentTaxAdjustmentDeductionRecord } from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "../db";
import { encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface ResidentTaxAdjustmentDeductionRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<ResidentTaxAdjustmentDeductionRecord | null>;
  upsert(params: { taxYearId: number; adjustmentDeductionJpy: string }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

export function createPrismaResidentTaxAdjustmentDeductionRecordRepository(): ResidentTaxAdjustmentDeductionRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<ResidentTaxAdjustmentDeductionRecord | null> {
      return prisma.residentTaxAdjustmentDeductionRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, adjustmentDeductionJpy }): Promise<void> {
      await prisma.residentTaxAdjustmentDeductionRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, adjustmentDeductionJpy },
        update: { adjustmentDeductionJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.residentTaxAdjustmentDeductionRecord.deleteMany({ where: { taxYearId } });
    },
  };
}

function rowToResidentTaxAdjustmentDeductionRecord(
  row: Record<string, SqlValue>,
): ResidentTaxAdjustmentDeductionRecord {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    adjustmentDeductionJpy: new Prisma.Decimal(String(row.adjustment_deduction_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-22)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientResidentTaxAdjustmentDeductionRecordRepository(
  db: ClientDb,
): ResidentTaxAdjustmentDeductionRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<ResidentTaxAdjustmentDeductionRecord | null> {
      const rows = await db.all(
        `SELECT id, tax_year_id, adjustment_deduction_jpy, created_at, updated_at
         FROM resident_tax_adjustment_deduction_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
      const row = rows[0];
      return row ? rowToResidentTaxAdjustmentDeductionRecord(row) : null;
    },

    async upsert({ taxYearId, adjustmentDeductionJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encoded = encodeDecimal(new Decimal(adjustmentDeductionJpy));
      await db.run(
        `INSERT INTO resident_tax_adjustment_deduction_record
           (tax_year_id, adjustment_deduction_jpy, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(tax_year_id) DO UPDATE SET
           adjustment_deduction_jpy = excluded.adjustment_deduction_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, encoded, now, now],
      );
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await db.run(
        `DELETE FROM resident_tax_adjustment_deduction_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
    },
  };
}
