/**
 * フェーズ1(リポジトリパターン導入): `src/lib/multiHouseholdRenovationDeduction.ts`が直接
 * `prisma.multiHouseholdRenovationDeductionRecord`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-7でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientMultiHouseholdRenovationDeductionRecordRepository`。wa-sqlite)を追加した。
 */
import { Prisma, type MultiHouseholdRenovationDeductionRecord } from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "../db";
import { encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface MultiHouseholdRenovationDeductionRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<MultiHouseholdRenovationDeductionRecord | null>;
  upsert(params: { taxYearId: number; creditJpy: string }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

export function createPrismaMultiHouseholdRenovationDeductionRecordRepository(): MultiHouseholdRenovationDeductionRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<MultiHouseholdRenovationDeductionRecord | null> {
      return prisma.multiHouseholdRenovationDeductionRecord.findUnique({ where: { taxYearId } });
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      await prisma.multiHouseholdRenovationDeductionRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, creditJpy },
        update: { creditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.multiHouseholdRenovationDeductionRecord.deleteMany({ where: { taxYearId } });
    },
  };
}

function rowToMultiHouseholdRenovationDeductionRecord(
  row: Record<string, SqlValue>,
): MultiHouseholdRenovationDeductionRecord {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    creditJpy: new Prisma.Decimal(String(row.credit_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-7)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientMultiHouseholdRenovationDeductionRecordRepository(
  db: ClientDb,
): MultiHouseholdRenovationDeductionRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<MultiHouseholdRenovationDeductionRecord | null> {
      const rows = await db.all(
        `SELECT id, tax_year_id, credit_jpy, created_at, updated_at
         FROM multi_household_renovation_deduction_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
      const row = rows[0];
      return row ? rowToMultiHouseholdRenovationDeductionRecord(row) : null;
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encoded = encodeDecimal(new Decimal(creditJpy));
      await db.run(
        `INSERT INTO multi_household_renovation_deduction_record
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
        `DELETE FROM multi_household_renovation_deduction_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
    },
  };
}
