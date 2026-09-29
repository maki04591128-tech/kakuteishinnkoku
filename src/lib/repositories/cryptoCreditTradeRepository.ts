/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`・`src/app/actions.ts`が
 * 直接`prisma.cryptoCreditTrade`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/import/page.tsx`側の`prisma.cryptoCreditTrade`呼び出しは
 * 移行時に別途このリポジトリへ委譲する)
 */
import type { CryptoCreditTrade, Prisma } from "@prisma/client";
import { prisma } from "../db";

export interface CryptoCreditTradeRepository {
  findByTaxYearId(taxYearId: number): Promise<CryptoCreditTrade[]>;
  create(
    data: Prisma.CryptoCreditTradeUncheckedCreateInput,
  ): Promise<CryptoCreditTrade>;
  delete(id: number): Promise<void>;
}

export function createPrismaCryptoCreditTradeRepository(): CryptoCreditTradeRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<CryptoCreditTrade[]> {
      return prisma.cryptoCreditTrade.findMany({ where: { taxYearId } });
    },

    async create(
      data: Prisma.CryptoCreditTradeUncheckedCreateInput,
    ): Promise<CryptoCreditTrade> {
      return prisma.cryptoCreditTrade.create({ data });
    },

    async delete(id: number): Promise<void> {
      await prisma.cryptoCreditTrade.delete({ where: { id } });
    },
  };
}
