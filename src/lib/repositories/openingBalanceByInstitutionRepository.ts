/**
 * フェーズ1(リポジトリパターン導入): `src/app/actions.ts`・
 * `src/app/import/page.tsx`が直接`prisma.openingBalanceByInstitution`を
 * 呼んでいた処理をこのインターフェース経由に置き換える。挙動は既存の
 * Prisma実装と完全に一致させる。
 * フェーズ2-28でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientOpeningBalanceByInstitutionRepository`。wa-sqlite)を追加した。
 */
import {
  Prisma,
  type OpeningBalanceAssetClass,
  type OpeningBalanceByInstitution,
} from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "../db";
import { encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface OpeningBalanceByInstitutionRepository {
  findByTaxYearId(
    taxYearId: number,
  ): Promise<OpeningBalanceByInstitution[]>;
  upsert(params: {
    taxYearId: number;
    assetClass: OpeningBalanceAssetClass;
    symbol: string;
    institution: string;
    quantity: string;
  }): Promise<void>;
  delete(id: number): Promise<void>;
}

export function createPrismaOpeningBalanceByInstitutionRepository(): OpeningBalanceByInstitutionRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<OpeningBalanceByInstitution[]> {
      return prisma.openingBalanceByInstitution.findMany({
        where: { taxYearId },
      });
    },

    async upsert({
      taxYearId,
      assetClass,
      symbol,
      institution,
      quantity,
    }): Promise<void> {
      await prisma.openingBalanceByInstitution.upsert({
        where: {
          taxYearId_assetClass_symbol_institution: {
            taxYearId,
            assetClass,
            symbol,
            institution,
          },
        },
        create: { taxYearId, assetClass, symbol, institution, quantity },
        update: { quantity },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.openingBalanceByInstitution.delete({ where: { id } });
    },
  };
}

function rowToOpeningBalanceByInstitution(
  row: Record<string, SqlValue>,
): OpeningBalanceByInstitution {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    assetClass: String(row.asset_class) as OpeningBalanceAssetClass,
    symbol: String(row.symbol),
    institution: String(row.institution),
    quantity: new Prisma.Decimal(String(row.quantity)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-28)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientOpeningBalanceByInstitutionRepository(
  db: ClientDb,
): OpeningBalanceByInstitutionRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<OpeningBalanceByInstitution[]> {
      const rows = await db.all(
        `SELECT id, tax_year_id, asset_class, symbol, institution,
                quantity, created_at, updated_at
         FROM opening_balance_by_institution
         WHERE tax_year_id = ? ORDER BY asset_class, symbol, institution`,
        [taxYearId],
      );
      return rows.map(rowToOpeningBalanceByInstitution);
    },

    async upsert({
      taxYearId,
      assetClass,
      symbol,
      institution,
      quantity,
    }): Promise<void> {
      const now = new Date().toISOString();
      const encodedQuantity = encodeDecimal(new Decimal(quantity));
      await db.run(
        `INSERT INTO opening_balance_by_institution
           (tax_year_id, asset_class, symbol, institution,
            quantity, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tax_year_id, asset_class, symbol, institution) DO UPDATE SET
           quantity = excluded.quantity,
           updated_at = excluded.updated_at`,
        [taxYearId, assetClass, symbol, institution, encodedQuantity, now, now],
      );
    },

    async delete(id: number): Promise<void> {
      await db.run(`DELETE FROM opening_balance_by_institution WHERE id = ?`, [
        id,
      ]);
    },
  };
}
