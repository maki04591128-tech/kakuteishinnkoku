/**
 * フェーズ1(リポジトリパターン導入): `src/app/home-sale-loss-deduction/page.tsx`が
 * 直接`prisma.homeSaleLossCarryforward`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-18でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientHomeSaleLossCarryforwardRepository`。wa-sqlite)を追加した。
 */
import { Prisma, type HomeSaleLossCarryforward } from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "../db";
import { encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface HomeSaleLossCarryforwardRepository {
  findByTaxYearId(taxYearId: number): Promise<HomeSaleLossCarryforward[]>;
  upsert(params: {
    taxYearId: number;
    originYear: number;
    remainingAmountJpy: string;
  }): Promise<void>;
  delete(id: number): Promise<void>;
  createMany(
    data: Array<{ taxYearId: number; originYear: number; remainingAmountJpy: string }>,
  ): Promise<void>;
}

export function createPrismaHomeSaleLossCarryforwardRepository(): HomeSaleLossCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<HomeSaleLossCarryforward[]> {
      return prisma.homeSaleLossCarryforward.findMany({
        where: { taxYearId },
        orderBy: { originYear: "asc" },
      });
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      await prisma.homeSaleLossCarryforward.upsert({
        where: {
          taxYearId_originYear: { taxYearId, originYear },
        },
        create: { taxYearId, originYear, remainingAmountJpy },
        update: { remainingAmountJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.homeSaleLossCarryforward.delete({ where: { id } });
    },

    async createMany(data): Promise<void> {
      if (data.length === 0) return;
      await prisma.homeSaleLossCarryforward.createMany({ data });
    },
  };
}

function rowToHomeSaleLossCarryforward(
  row: Record<string, SqlValue>,
): HomeSaleLossCarryforward {
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
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-18)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientHomeSaleLossCarryforwardRepository(
  db: ClientDb,
): HomeSaleLossCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<HomeSaleLossCarryforward[]> {
      const rows = await db.all(
        `SELECT id, tax_year_id, origin_year, remaining_amount_jpy, created_at, updated_at
         FROM home_sale_loss_carryforward WHERE tax_year_id = ? ORDER BY origin_year`,
        [taxYearId],
      );
      return rows.map(rowToHomeSaleLossCarryforward);
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encoded = encodeDecimal(new Decimal(remainingAmountJpy));
      await db.run(
        `INSERT INTO home_sale_loss_carryforward
           (tax_year_id, origin_year, remaining_amount_jpy, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(tax_year_id, origin_year) DO UPDATE SET
           remaining_amount_jpy = excluded.remaining_amount_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, originYear, encoded, now, now],
      );
    },

    async delete(id: number): Promise<void> {
      await db.run(`DELETE FROM home_sale_loss_carryforward WHERE id = ?`, [id]);
    },

    async createMany(data): Promise<void> {
      const now = new Date().toISOString();
      for (const { taxYearId, originYear, remainingAmountJpy } of data) {
        const encoded = encodeDecimal(new Decimal(remainingAmountJpy));
        await db.run(
          `INSERT INTO home_sale_loss_carryforward
             (tax_year_id, origin_year, remaining_amount_jpy, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [taxYearId, originYear, encoded, now, now],
        );
      }
    },
  };
}
