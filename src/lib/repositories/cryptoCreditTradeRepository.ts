/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`が直接
 * `prisma.cryptoCreditTrade`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/actions.ts`・`src/app/import/page.tsx`側の`prisma.cryptoCreditTrade`
 * 呼び出しはそれぞれの移行時に別途このリポジトリへ委譲する)
 */
import type { CryptoCreditTrade } from "@prisma/client";
import { prisma } from "../db";

export interface CryptoCreditTradeRepository {
  findByTaxYearId(taxYearId: number): Promise<CryptoCreditTrade[]>;
}

export function createPrismaCryptoCreditTradeRepository(): CryptoCreditTradeRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<CryptoCreditTrade[]> {
      return prisma.cryptoCreditTrade.findMany({ where: { taxYearId } });
    },
  };
}
