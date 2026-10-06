/**
 * フェーズ5-1-3b: `MarketPriceRepository`のPrisma実装(自宅サーバー版が使う)。
 * `../db`経由で`@prisma/client`(Node専用)に依存するため、クライアント実装
 * (`createClientMarketPriceRepository`。`marketPriceRepository.ts`)とは別ファイルに
 * する。これにより、スタンドアロン版ビルドで
 * `@/lib/repositories/defaultMarketPriceRepository`を
 * `defaultMarketPriceRepository.standalone.ts`に差し替えた際、このファイル
 * (と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { MarketPriceRepository } from "./marketPriceRepository";
import type { MarketPrice } from "@prisma/client";

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
