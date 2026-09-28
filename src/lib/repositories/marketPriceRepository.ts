/**
 * フェーズ1(リポジトリパターン導入): `src/app/unrealized-gain/page.tsx`が
 * 直接`prisma.marketPrice`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/actions.ts`・`src/app/import/page.tsx`側の`prisma.marketPrice`呼び出しは
 * それぞれの移行時に別途このリポジトリへ委譲する)
 */
import type { MarketPrice } from "@prisma/client";
import { prisma } from "../db";

export interface MarketPriceRepository {
  findMany(): Promise<MarketPrice[]>;
}

export function createPrismaMarketPriceRepository(): MarketPriceRepository {
  return {
    async findMany(): Promise<MarketPrice[]> {
      return prisma.marketPrice.findMany();
    },
  };
}
