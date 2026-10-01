/**
 * フェーズ1(リポジトリパターン導入): `src/lib/mortgageDeduction.ts`が直接
 * `prisma.mortgageDeductionRecord`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-21でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientMortgageDeductionRecordRepository`。wa-sqlite)を追加した。
 */
import { Prisma, type MortgageDeductionRecord } from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "../db";
import { encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface MortgageDeductionRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<MortgageDeductionRecord | null>;
  upsert(params: {
    taxYearId: number;
    nationalTaxCreditJpy: string;
    residentTaxCreditJpy: string;
  }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

export function createPrismaMortgageDeductionRecordRepository(): MortgageDeductionRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<MortgageDeductionRecord | null> {
      return prisma.mortgageDeductionRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, nationalTaxCreditJpy, residentTaxCreditJpy }): Promise<void> {
      await prisma.mortgageDeductionRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, nationalTaxCreditJpy, residentTaxCreditJpy },
        update: { nationalTaxCreditJpy, residentTaxCreditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.mortgageDeductionRecord.deleteMany({ where: { taxYearId } });
    },
  };
}

function rowToMortgageDeductionRecord(row: Record<string, SqlValue>): MortgageDeductionRecord {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    nationalTaxCreditJpy: new Prisma.Decimal(String(row.national_tax_credit_jpy)),
    residentTaxCreditJpy: new Prisma.Decimal(String(row.resident_tax_credit_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-21)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientMortgageDeductionRecordRepository(
  db: ClientDb,
): MortgageDeductionRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<MortgageDeductionRecord | null> {
      const rows = await db.all(
        `SELECT id, tax_year_id, national_tax_credit_jpy, resident_tax_credit_jpy,
                created_at, updated_at
         FROM mortgage_deduction_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
      const row = rows[0];
      return row ? rowToMortgageDeductionRecord(row) : null;
    },

    async upsert({ taxYearId, nationalTaxCreditJpy, residentTaxCreditJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encodedNational = encodeDecimal(new Decimal(nationalTaxCreditJpy));
      const encodedResident = encodeDecimal(new Decimal(residentTaxCreditJpy));
      await db.run(
        `INSERT INTO mortgage_deduction_record
           (tax_year_id, national_tax_credit_jpy, resident_tax_credit_jpy,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(tax_year_id) DO UPDATE SET
           national_tax_credit_jpy = excluded.national_tax_credit_jpy,
           resident_tax_credit_jpy = excluded.resident_tax_credit_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, encodedNational, encodedResident, now, now],
      );
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await db.run(`DELETE FROM mortgage_deduction_record WHERE tax_year_id = ?`, [taxYearId]);
    },
  };
}
