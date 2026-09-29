/**
 * フェーズ1(リポジトリパターン導入): `src/app/unrealized-gain/page.tsx`・
 * `src/app/actions.ts`が直接`prisma.marketPrice`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/import/page.tsx`側の`prisma.marketPrice`呼び出しは移行時に
 * 別途このリポジトリへ委譲する)
 */
import type { MarketPrice } from "@prisma/client";
import { prisma } from "../db";

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
