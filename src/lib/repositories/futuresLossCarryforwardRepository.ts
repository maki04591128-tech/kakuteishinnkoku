/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`が直接
 * `prisma.futuresLossCarryforward`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/actions.ts`・`src/app/import/page.tsx`側の
 * `prisma.futuresLossCarryforward`呼び出しはそれぞれの移行時に別途この
 * リポジトリへ委譲する)
 */
import type { FuturesLossCarryforward } from "@prisma/client";
import { prisma } from "../db";

export interface FuturesLossCarryforwardRepository {
  findByTaxYearId(taxYearId: number): Promise<FuturesLossCarryforward[]>;
}

export function createPrismaFuturesLossCarryforwardRepository(): FuturesLossCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<FuturesLossCarryforward[]> {
      return prisma.futuresLossCarryforward.findMany({
        where: { taxYearId },
      });
    },
  };
}
