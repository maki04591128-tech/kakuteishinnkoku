/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`が直接
 * `prisma.cryptoMarginTrade`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/actions.ts`・`src/app/import/page.tsx`側の`prisma.cryptoMarginTrade`
 * 呼び出しはそれぞれの移行時に別途このリポジトリへ委譲する)
 */
import type { CryptoMarginTrade } from "@prisma/client";
import { prisma } from "../db";

export interface CryptoMarginTradeRepository {
  findByTaxYearId(taxYearId: number): Promise<CryptoMarginTrade[]>;
}

export function createPrismaCryptoMarginTradeRepository(): CryptoMarginTradeRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<CryptoMarginTrade[]> {
      return prisma.cryptoMarginTrade.findMany({ where: { taxYearId } });
    },
  };
}
