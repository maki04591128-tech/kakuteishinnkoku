/**
 * フェーズ1(リポジトリパターン導入): `src/app/unrealized-gain/page.tsx`・
 * `src/app/actions.ts`が直接`prisma.marketPrice`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/import/page.tsx`側の`prisma.marketPrice`呼び出しは移行時に
 * 別途このリポジトリへ委譲する)
 * フェーズ2-29でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientMarketPriceRepository`。wa-sqlite)を追加した。
 */
import { Prisma, type MarketPrice } from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "../db";
import { encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface MarketPriceRepository {
  findMany(): Promise<MarketPrice[]>;
  upsert(params: { symbol: string; priceJpy: string }): Promise<void>;
  delete(id: number): Promise<void>;
}

export function createPrismaMarketPriceRepository(): MarketPriceRepository {
  return {
    async findMany(): Promise<MarketPrice[]> {
      return prisma.marketPrice.findMany();
    },

    async upsert({ symbol, priceJpy }): Promise<void> {
      await prisma.marketPrice.upsert({
        where: { symbol },
        create: { symbol, priceJpy },
        update: { priceJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.marketPrice.delete({ where: { id } });
    },
  };
}

function rowToMarketPrice(row: Record<string, SqlValue>): MarketPrice {
  return {
    id: Number(row.id),
    symbol: String(row.symbol),
    priceJpy: new Prisma.Decimal(String(row.price_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-29)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientMarketPriceRepository(
  db: ClientDb,
): MarketPriceRepository {
  return {
    async findMany(): Promise<MarketPrice[]> {
      const rows = await db.all(
        `SELECT id, symbol, price_jpy, created_at, updated_at
         FROM market_price ORDER BY id`,
      );
      return rows.map(rowToMarketPrice);
    },

    async upsert({ symbol, priceJpy }): Promise<void> {
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO market_price (symbol, price_jpy, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(symbol) DO UPDATE SET
           price_jpy = excluded.price_jpy,
           updated_at = excluded.updated_at`,
        [symbol, encodeDecimal(new Decimal(priceJpy)), now, now],
      );
    },

    async delete(id: number): Promise<void> {
      await db.run(`DELETE FROM market_price WHERE id = ?`, [id]);
    },
  };
}
