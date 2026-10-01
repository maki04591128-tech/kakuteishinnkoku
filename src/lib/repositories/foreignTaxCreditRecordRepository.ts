/**
 * フェーズ1(リポジトリパターン導入): `src/lib/investment/foreignTaxCredit.ts`が直接
 * `prisma.foreignTaxCreditRecord`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-24でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientForeignTaxCreditRecordRepository`。wa-sqlite)を追加した。
 */
import { Prisma, type ForeignTaxCreditRecord } from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "../db";
import { encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface ForeignTaxCreditRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<ForeignTaxCreditRecord | null>;
  upsert(params: {
    taxYearId: number;
    totalCreditJpy: string;
    nationalTaxCreditJpy: string;
    residentTaxCreditJpy: string;
  }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

export function createPrismaForeignTaxCreditRecordRepository(): ForeignTaxCreditRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<ForeignTaxCreditRecord | null> {
      return prisma.foreignTaxCreditRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({
      taxYearId,
      totalCreditJpy,
      nationalTaxCreditJpy,
      residentTaxCreditJpy,
    }): Promise<void> {
      await prisma.foreignTaxCreditRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, totalCreditJpy, nationalTaxCreditJpy, residentTaxCreditJpy },
        update: { totalCreditJpy, nationalTaxCreditJpy, residentTaxCreditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.foreignTaxCreditRecord.deleteMany({ where: { taxYearId } });
    },
  };
}

function rowToForeignTaxCreditRecord(row: Record<string, SqlValue>): ForeignTaxCreditRecord {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    totalCreditJpy: new Prisma.Decimal(String(row.total_tax_credit_jpy)),
    nationalTaxCreditJpy: new Prisma.Decimal(String(row.national_tax_credit_jpy)),
    residentTaxCreditJpy: new Prisma.Decimal(String(row.resident_tax_credit_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-24)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientForeignTaxCreditRecordRepository(
  db: ClientDb,
): ForeignTaxCreditRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<ForeignTaxCreditRecord | null> {
      const rows = await db.all(
        `SELECT id, tax_year_id, total_tax_credit_jpy, national_tax_credit_jpy,
                resident_tax_credit_jpy, created_at, updated_at
         FROM foreign_tax_credit_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
      const row = rows[0];
      return row ? rowToForeignTaxCreditRecord(row) : null;
    },

    async upsert({
      taxYearId,
      totalCreditJpy,
      nationalTaxCreditJpy,
      residentTaxCreditJpy,
    }): Promise<void> {
      const now = new Date().toISOString();
      const encodedTotal = encodeDecimal(new Decimal(totalCreditJpy));
      const encodedNational = encodeDecimal(new Decimal(nationalTaxCreditJpy));
      const encodedResident = encodeDecimal(new Decimal(residentTaxCreditJpy));
      await db.run(
        `INSERT INTO foreign_tax_credit_record
           (tax_year_id, total_tax_credit_jpy, national_tax_credit_jpy,
            resident_tax_credit_jpy, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(tax_year_id) DO UPDATE SET
           total_tax_credit_jpy = excluded.total_tax_credit_jpy,
           national_tax_credit_jpy = excluded.national_tax_credit_jpy,
           resident_tax_credit_jpy = excluded.resident_tax_credit_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, encodedTotal, encodedNational, encodedResident, now, now],
      );
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await db.run(`DELETE FROM foreign_tax_credit_record WHERE tax_year_id = ?`, [taxYearId]);
    },
  };
}
