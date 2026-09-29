/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`・`src/app/actions.ts`が
 * 直接`prisma.stockMarginTrade`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/import/page.tsx`側の`prisma.stockMarginTrade`呼び出しは
 * 移行時に別途このリポジトリへ委譲する)
 */
import type { StockMarginTrade, Prisma } from "@prisma/client";
import { prisma } from "../db";

export interface StockMarginTradeRepository {
  findByTaxYearId(taxYearId: number): Promise<StockMarginTrade[]>;
  create(
    data: Prisma.StockMarginTradeUncheckedCreateInput,
  ): Promise<StockMarginTrade>;
  delete(id: number): Promise<void>;
}

export function createPrismaStockMarginTradeRepository(): StockMarginTradeRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<StockMarginTrade[]> {
      return prisma.stockMarginTrade.findMany({ where: { taxYearId } });
    },

    async create(
      data: Prisma.StockMarginTradeUncheckedCreateInput,
    ): Promise<StockMarginTrade> {
      return prisma.stockMarginTrade.create({ data });
    },

    async delete(id: number): Promise<void> {
      await prisma.stockMarginTrade.delete({ where: { id } });
    },
  };
}
