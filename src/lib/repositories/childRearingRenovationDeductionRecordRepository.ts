/**
 * フェーズ1(リポジトリパターン導入): `src/lib/childRearingRenovationDeduction.ts`が
 * 直接`prisma.childRearingRenovationDeductionRecord`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-9でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientChildRearingRenovationDeductionRecordRepository`。wa-sqlite)を追加した。
 */
import { Prisma, type ChildRearingRenovationDeductionRecord } from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "../db";
import { encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface ChildRearingRenovationDeductionRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<ChildRearingRenovationDeductionRecord | null>;
  upsert(params: { taxYearId: number; creditJpy: string }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

export function createPrismaChildRearingRenovationDeductionRecordRepository(): ChildRearingRenovationDeductionRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<ChildRearingRenovationDeductionRecord | null> {
      return prisma.childRearingRenovationDeductionRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      await prisma.childRearingRenovationDeductionRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, creditJpy },
        update: { creditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.childRearingRenovationDeductionRecord.deleteMany({ where: { taxYearId } });
    },
  };
}

function rowToChildRearingRenovationDeductionRecord(
  row: Record<string, SqlValue>,
): ChildRearingRenovationDeductionRecord {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    creditJpy: new Prisma.Decimal(String(row.credit_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-9)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientChildRearingRenovationDeductionRecordRepository(
  db: ClientDb,
): ChildRearingRenovationDeductionRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<ChildRearingRenovationDeductionRecord | null> {
      const rows = await db.all(
        `SELECT id, tax_year_id, credit_jpy, created_at, updated_at
         FROM child_rearing_renovation_deduction_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
      const row = rows[0];
      return row ? rowToChildRearingRenovationDeductionRecord(row) : null;
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encoded = encodeDecimal(new Decimal(creditJpy));
      await db.run(
        `INSERT INTO child_rearing_renovation_deduction_record
           (tax_year_id, credit_jpy, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(tax_year_id) DO UPDATE SET
           credit_jpy = excluded.credit_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, encoded, now, now],
      );
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await db.run(
        `DELETE FROM child_rearing_renovation_deduction_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
    },
  };
}
