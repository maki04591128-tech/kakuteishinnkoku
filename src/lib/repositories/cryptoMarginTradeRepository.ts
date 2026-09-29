/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`・`src/app/actions.ts`が
 * 直接`prisma.cryptoMarginTrade`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/import/page.tsx`側の`prisma.cryptoMarginTrade`呼び出しは
 * 移行時に別途このリポジトリへ委譲する)
 */
import type { CryptoMarginTrade, Prisma } from "@prisma/client";
import { prisma } from "../db";

export interface CryptoMarginTradeRepository {
  findByTaxYearId(taxYearId: number): Promise<CryptoMarginTrade[]>;
  create(
    data: Prisma.CryptoMarginTradeUncheckedCreateInput,
  ): Promise<CryptoMarginTrade>;
  delete(id: number): Promise<void>;
}

export function createPrismaCryptoMarginTradeRepository(): CryptoMarginTradeRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<CryptoMarginTrade[]> {
      return prisma.cryptoMarginTrade.findMany({ where: { taxYearId } });
    },

    async create(
      data: Prisma.CryptoMarginTradeUncheckedCreateInput,
    ): Promise<CryptoMarginTrade> {
      return prisma.cryptoMarginTrade.create({ data });
    },

    async delete(id: number): Promise<void> {
      await prisma.cryptoMarginTrade.delete({ where: { id } });
    },
  };
}
