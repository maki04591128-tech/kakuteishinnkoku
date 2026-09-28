/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`が直接
 * `prisma.investmentLossCarryforward`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/actions.ts`・`src/app/import/page.tsx`側の
 * `prisma.investmentLossCarryforward`呼び出しはそれぞれの移行時に別途この
 * リポジトリへ委譲する)
 */
import type { InvestmentLossCarryforward } from "@prisma/client";
import { prisma } from "../db";

export interface InvestmentLossCarryforwardRepository {
  findByTaxYearId(taxYearId: number): Promise<InvestmentLossCarryforward[]>;
}

export function createPrismaInvestmentLossCarryforwardRepository(): InvestmentLossCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<InvestmentLossCarryforward[]> {
      return prisma.investmentLossCarryforward.findMany({
        where: { taxYearId },
      });
    },
  };
}
