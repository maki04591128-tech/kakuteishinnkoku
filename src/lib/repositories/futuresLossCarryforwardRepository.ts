/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`・`src/app/actions.ts`が
 * 直接`prisma.futuresLossCarryforward`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/import/page.tsx`側の`prisma.futuresLossCarryforward`呼び出しは
 * 移行時に別途このリポジトリへ委譲する)
 * フェーズ2-13でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientFuturesLossCarryforwardRepository`。wa-sqlite)を追加した。
 */
import { Prisma, type FuturesLossCarryforward } from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "../db";
import { encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface FuturesLossCarryforwardRepository {
  findByTaxYearId(taxYearId: number): Promise<FuturesLossCarryforward[]>;
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

export function createPrismaFuturesLossCarryforwardRepository(): FuturesLossCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<FuturesLossCarryforward[]> {
      return prisma.futuresLossCarryforward.findMany({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      await prisma.futuresLossCarryforward.upsert({
        where: {
          taxYearId_originYear: { taxYearId, originYear },
        },
        create: { taxYearId, originYear, remainingAmountJpy },
        update: { remainingAmountJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.futuresLossCarryforward.delete({ where: { id } });
    },

    async createMany(data): Promise<void> {
      if (data.length === 0) return;
      await prisma.futuresLossCarryforward.createMany({ data });
    },
  };
}

function rowToFuturesLossCarryforward(row: Record<string, SqlValue>): FuturesLossCarryforward {
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
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-13)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientFuturesLossCarryforwardRepository(
  db: ClientDb,
): FuturesLossCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<FuturesLossCarryforward[]> {
      const rows = await db.all(
        `SELECT id, tax_year_id, origin_year, remaining_amount_jpy, created_at, updated_at
         FROM futures_loss_carryforward WHERE tax_year_id = ? ORDER BY origin_year`,
        [taxYearId],
      );
      return rows.map(rowToFuturesLossCarryforward);
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encoded = encodeDecimal(new Decimal(remainingAmountJpy));
      await db.run(
        `INSERT INTO futures_loss_carryforward
           (tax_year_id, origin_year, remaining_amount_jpy, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(tax_year_id, origin_year) DO UPDATE SET
           remaining_amount_jpy = excluded.remaining_amount_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, originYear, encoded, now, now],
      );
    },

    async delete(id: number): Promise<void> {
      await db.run(`DELETE FROM futures_loss_carryforward WHERE id = ?`, [id]);
    },

    async createMany(data): Promise<void> {
      const now = new Date().toISOString();
      for (const { taxYearId, originYear, remainingAmountJpy } of data) {
        const encoded = encodeDecimal(new Decimal(remainingAmountJpy));
        await db.run(
          `INSERT INTO futures_loss_carryforward
             (tax_year_id, origin_year, remaining_amount_jpy, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [taxYearId, originYear, encoded, now, now],
        );
      }
    },
  };
}
