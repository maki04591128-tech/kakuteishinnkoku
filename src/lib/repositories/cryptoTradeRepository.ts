/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`・`src/app/actions.ts`が
 * 直接`prisma.cryptoTrade`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/import/page.tsx`側の`prisma.cryptoTrade`呼び出しは
 * 移行時に別途このリポジトリへ委譲する)
 */
import type { CryptoTrade, Prisma } from "@prisma/client";
import { prisma } from "../db";

export interface CryptoTradeRepository {
  findByTaxYearId(taxYearId: number): Promise<CryptoTrade[]>;
  create(data: Prisma.CryptoTradeUncheckedCreateInput): Promise<CryptoTrade>;
  delete(id: number): Promise<void>;
}

export function createPrismaCryptoTradeRepository(): CryptoTradeRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<CryptoTrade[]> {
      return prisma.cryptoTrade.findMany({ where: { taxYearId } });
    },

    async create(data: Prisma.CryptoTradeUncheckedCreateInput): Promise<CryptoTrade> {
      return prisma.cryptoTrade.create({ data });
    },

    async delete(id: number): Promise<void> {
      await prisma.cryptoTrade.delete({ where: { id } });
    },
  };
}
