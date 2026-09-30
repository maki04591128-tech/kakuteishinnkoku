/**
 * フェーズ1(リポジトリパターン導入): `src/lib/certifiedHousingConstructionCredit.ts`が
 * 直接`prisma.certifiedHousingConstructionCreditCarryforward`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-11でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientCertifiedHousingConstructionCreditCarryforwardRepository`。wa-sqlite)を追加した。
 */
import { Prisma, type CertifiedHousingConstructionCreditCarryforward } from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "../db";
import { encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface CertifiedHousingConstructionCreditCarryforwardRepository {
  findByTaxYearId(
    taxYearId: number,
  ): Promise<CertifiedHousingConstructionCreditCarryforward | null>;
  upsert(params: { taxYearId: number; originYear: number; remainingAmountJpy: string }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

export function createPrismaCertifiedHousingConstructionCreditCarryforwardRepository(): CertifiedHousingConstructionCreditCarryforwardRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<CertifiedHousingConstructionCreditCarryforward | null> {
      return prisma.certifiedHousingConstructionCreditCarryforward.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      await prisma.certifiedHousingConstructionCreditCarryforward.upsert({
        where: { taxYearId },
        create: { taxYearId, originYear, remainingAmountJpy },
        update: { originYear, remainingAmountJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.certifiedHousingConstructionCreditCarryforward.deleteMany({
        where: { taxYearId },
      });
    },
  };
}

function rowToCertifiedHousingConstructionCreditCarryforward(
  row: Record<string, SqlValue>,
): CertifiedHousingConstructionCreditCarryforward {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    originYear: Number(row.origin_year),
    remainingAmountJpy: new Prisma.Decimal(String(row.remaining_amount_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-11)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientCertifiedHousingConstructionCreditCarryforwardRepository(
  db: ClientDb,
): CertifiedHousingConstructionCreditCarryforwardRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<CertifiedHousingConstructionCreditCarryforward | null> {
      const rows = await db.all(
        `SELECT id, tax_year_id, origin_year, remaining_amount_jpy, created_at, updated_at
         FROM certified_housing_construction_credit_carryforward WHERE tax_year_id = ?`,
        [taxYearId],
      );
      const row = rows[0];
      return row ? rowToCertifiedHousingConstructionCreditCarryforward(row) : null;
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encoded = encodeDecimal(new Decimal(remainingAmountJpy));
      await db.run(
        `INSERT INTO certified_housing_construction_credit_carryforward
           (tax_year_id, origin_year, remaining_amount_jpy, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(tax_year_id) DO UPDATE SET
           origin_year = excluded.origin_year,
           remaining_amount_jpy = excluded.remaining_amount_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, originYear, encoded, now, now],
      );
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await db.run(
        `DELETE FROM certified_housing_construction_credit_carryforward WHERE tax_year_id = ?`,
        [taxYearId],
      );
    },
  };
}
