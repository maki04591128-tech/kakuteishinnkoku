/**
 * フェーズ1(リポジトリパターン導入): `src/app/home-replacement-loss-deduction/page.tsx`が
 * 直接`prisma.homeReplacementLossCarryforward`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { HomeReplacementLossCarryforward } from "@prisma/client";
import { prisma } from "../db";

export interface HomeReplacementLossCarryforwardRepository {
  findByTaxYearId(taxYearId: number): Promise<HomeReplacementLossCarryforward[]>;
}

export function createPrismaHomeReplacementLossCarryforwardRepository(): HomeReplacementLossCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<HomeReplacementLossCarryforward[]> {
      return prisma.homeReplacementLossCarryforward.findMany({
        where: { taxYearId },
        orderBy: { originYear: "asc" },
      });
    },
  };
}
