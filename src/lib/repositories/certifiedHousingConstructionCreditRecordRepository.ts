/**
 * フェーズ1(リポジトリパターン導入): `src/lib/certifiedHousingConstructionCredit.ts`が
 * 直接`prisma.certifiedHousingConstructionCreditRecord`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-10でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientCertifiedHousingConstructionCreditRecordRepository`。wa-sqlite)を追加した。
 */
import { Prisma, type CertifiedHousingConstructionCreditRecord } from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "../db";
import { encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface CertifiedHousingConstructionCreditRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<CertifiedHousingConstructionCreditRecord | null>;
  upsert(params: { taxYearId: number; creditJpy: string }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

export function createPrismaCertifiedHousingConstructionCreditRecordRepository(): CertifiedHousingConstructionCreditRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<CertifiedHousingConstructionCreditRecord | null> {
      return prisma.certifiedHousingConstructionCreditRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      await prisma.certifiedHousingConstructionCreditRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, creditJpy },
        update: { creditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.certifiedHousingConstructionCreditRecord.deleteMany({ where: { taxYearId } });
    },
  };
}

function rowToCertifiedHousingConstructionCreditRecord(
  row: Record<string, SqlValue>,
): CertifiedHousingConstructionCreditRecord {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    creditJpy: new Prisma.Decimal(String(row.credit_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-10)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientCertifiedHousingConstructionCreditRecordRepository(
  db: ClientDb,
): CertifiedHousingConstructionCreditRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<CertifiedHousingConstructionCreditRecord | null> {
      const rows = await db.all(
        `SELECT id, tax_year_id, credit_jpy, created_at, updated_at
         FROM certified_housing_construction_credit_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
      const row = rows[0];
      return row ? rowToCertifiedHousingConstructionCreditRecord(row) : null;
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encoded = encodeDecimal(new Decimal(creditJpy));
      await db.run(
        `INSERT INTO certified_housing_construction_credit_record
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
        `DELETE FROM certified_housing_construction_credit_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
    },
  };
}
