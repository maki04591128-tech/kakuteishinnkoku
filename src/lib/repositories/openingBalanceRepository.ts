/**
 * フェーズ1(リポジトリパターン導入): `src/lib/openingBalance.ts`が直接
 * `prisma.openingBalance`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { OpeningBalance } from "@prisma/client";
import { prisma } from "../db";

export interface OpeningBalanceRepository {
  findByTaxYearId(taxYearId: number): Promise<OpeningBalance[]>;
}

export function createPrismaOpeningBalanceRepository(): OpeningBalanceRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<OpeningBalance[]> {
      return prisma.openingBalance.findMany({ where: { taxYearId } });
    },
  };
}
