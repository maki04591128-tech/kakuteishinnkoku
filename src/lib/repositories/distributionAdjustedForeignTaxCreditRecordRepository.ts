/**
 * フェーズ1(リポジトリパターン導入): `src/lib/investment/distributionAdjustedForeignTaxCredit.ts`が
 * 直接`prisma.distributionAdjustedForeignTaxCreditRecord`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-23でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientDistributionAdjustedForeignTaxCreditRecordRepository`。wa-sqlite)を追加した。
 */
import { Prisma, type DistributionAdjustedForeignTaxCreditRecord } from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "../db";
import { encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface DistributionAdjustedForeignTaxCreditRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<DistributionAdjustedForeignTaxCreditRecord | null>;
  upsert(params: { taxYearId: number; creditJpy: string }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

export function createPrismaDistributionAdjustedForeignTaxCreditRecordRepository(): DistributionAdjustedForeignTaxCreditRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<DistributionAdjustedForeignTaxCreditRecord | null> {
      return prisma.distributionAdjustedForeignTaxCreditRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      await prisma.distributionAdjustedForeignTaxCreditRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, creditJpy },
        update: { creditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.distributionAdjustedForeignTaxCreditRecord.deleteMany({ where: { taxYearId } });
    },
  };
}

function rowToDistributionAdjustedForeignTaxCreditRecord(
  row: Record<string, SqlValue>,
): DistributionAdjustedForeignTaxCreditRecord {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    creditJpy: new Prisma.Decimal(String(row.credit_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-23)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientDistributionAdjustedForeignTaxCreditRecordRepository(
  db: ClientDb,
): DistributionAdjustedForeignTaxCreditRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<DistributionAdjustedForeignTaxCreditRecord | null> {
      const rows = await db.all(
        `SELECT id, tax_year_id, credit_jpy, created_at, updated_at
         FROM distribution_adjusted_foreign_tax_credit_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
      const row = rows[0];
      return row ? rowToDistributionAdjustedForeignTaxCreditRecord(row) : null;
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encoded = encodeDecimal(new Decimal(creditJpy));
      await db.run(
        `INSERT INTO distribution_adjusted_foreign_tax_credit_record
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
        `DELETE FROM distribution_adjusted_foreign_tax_credit_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
    },
  };
}
