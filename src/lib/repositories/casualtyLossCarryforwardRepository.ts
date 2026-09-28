/**
 * フェーズ1(リポジトリパターン導入): `src/app/casualty-loss-deduction/page.tsx`が
 * 直接`prisma.casualtyLossCarryforward`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { CasualtyLossCarryforward } from "@prisma/client";
import { prisma } from "../db";

export interface CasualtyLossCarryforwardRepository {
  findByTaxYearId(taxYearId: number): Promise<CasualtyLossCarryforward[]>;
}

export function createPrismaCasualtyLossCarryforwardRepository(): CasualtyLossCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<CasualtyLossCarryforward[]> {
      return prisma.casualtyLossCarryforward.findMany({
        where: { taxYearId },
        orderBy: { originYear: "asc" },
      });
    },
  };
}
