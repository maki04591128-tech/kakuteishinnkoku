/**
 * フェーズ1(リポジトリパターン導入): `src/lib/donationTaxCredit.ts`が
 * 直接`prisma.donationTaxCreditRecord`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-20でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientDonationTaxCreditRecordRepository`。wa-sqlite)を追加した。
 */
import { Prisma, type DonationTaxCreditRecord } from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "../db";
import { encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface DonationTaxCreditRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<DonationTaxCreditRecord | null>;
  upsert(params: {
    taxYearId: number;
    totalTaxCreditJpy: string;
    residentTaxBasicDeductionJpy: string;
  }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

export function createPrismaDonationTaxCreditRecordRepository(): DonationTaxCreditRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<DonationTaxCreditRecord | null> {
      return prisma.donationTaxCreditRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, totalTaxCreditJpy, residentTaxBasicDeductionJpy }): Promise<void> {
      await prisma.donationTaxCreditRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, totalTaxCreditJpy, residentTaxBasicDeductionJpy },
        update: { totalTaxCreditJpy, residentTaxBasicDeductionJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.donationTaxCreditRecord.deleteMany({ where: { taxYearId } });
    },
  };
}

function rowToDonationTaxCreditRecord(row: Record<string, SqlValue>): DonationTaxCreditRecord {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    totalTaxCreditJpy: new Prisma.Decimal(String(row.total_tax_credit_jpy)),
    residentTaxBasicDeductionJpy: new Prisma.Decimal(String(row.resident_tax_basic_deduction_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-20)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientDonationTaxCreditRecordRepository(
  db: ClientDb,
): DonationTaxCreditRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<DonationTaxCreditRecord | null> {
      const rows = await db.all(
        `SELECT id, tax_year_id, total_tax_credit_jpy, resident_tax_basic_deduction_jpy,
                created_at, updated_at
         FROM donation_tax_credit_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
      const row = rows[0];
      return row ? rowToDonationTaxCreditRecord(row) : null;
    },

    async upsert({ taxYearId, totalTaxCreditJpy, residentTaxBasicDeductionJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encodedTotal = encodeDecimal(new Decimal(totalTaxCreditJpy));
      const encodedResidentBasic = encodeDecimal(new Decimal(residentTaxBasicDeductionJpy));
      await db.run(
        `INSERT INTO donation_tax_credit_record
           (tax_year_id, total_tax_credit_jpy, resident_tax_basic_deduction_jpy,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(tax_year_id) DO UPDATE SET
           total_tax_credit_jpy = excluded.total_tax_credit_jpy,
           resident_tax_basic_deduction_jpy = excluded.resident_tax_basic_deduction_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, encodedTotal, encodedResidentBasic, now, now],
      );
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await db.run(`DELETE FROM donation_tax_credit_record WHERE tax_year_id = ?`, [taxYearId]);
    },
  };
}
