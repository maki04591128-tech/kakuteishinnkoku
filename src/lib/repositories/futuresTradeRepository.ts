/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`・`src/app/actions.ts`が
 * 直接`prisma.futuresTrade`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/import/page.tsx`側の`prisma.futuresTrade`呼び出しは
 * 移行時に別途このリポジトリへ委譲する)
 */
import type { FuturesTrade, Prisma } from "@prisma/client";
import { prisma } from "../db";

export interface FuturesTradeRepository {
  findByTaxYearId(taxYearId: number): Promise<FuturesTrade[]>;
  create(data: Prisma.FuturesTradeUncheckedCreateInput): Promise<FuturesTrade>;
  delete(id: number): Promise<void>;
}

export function createPrismaFuturesTradeRepository(): FuturesTradeRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<FuturesTrade[]> {
      return prisma.futuresTrade.findMany({ where: { taxYearId } });
    },

    async create(
      data: Prisma.FuturesTradeUncheckedCreateInput,
    ): Promise<FuturesTrade> {
      return prisma.futuresTrade.create({ data });
    },

    async delete(id: number): Promise<void> {
      await prisma.futuresTrade.delete({ where: { id } });
    },
  };
}
