/**
 * フェーズ1(リポジトリパターン導入): `src/app/angel-tax-loss-carryforward/page.tsx`が
 * 直接`prisma.angelTaxLossCarryforward`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { AngelTaxLossCarryforward } from "@prisma/client";
import { prisma } from "../db";

export interface AngelTaxLossCarryforwardRepository {
  findByTaxYearId(taxYearId: number): Promise<AngelTaxLossCarryforward[]>;
}

export function createPrismaAngelTaxLossCarryforwardRepository(): AngelTaxLossCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<AngelTaxLossCarryforward[]> {
      return prisma.angelTaxLossCarryforward.findMany({
        where: { taxYearId },
        orderBy: { originYear: "asc" },
      });
    },
  };
}
