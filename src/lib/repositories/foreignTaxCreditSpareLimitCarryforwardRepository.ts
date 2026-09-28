/**
 * フェーズ1(リポジトリパターン導入): `src/app/foreign-tax-credit/page.tsx`が
 * 直接`prisma.foreignTaxCreditSpareLimitCarryforward`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/actions.ts`側の`prisma.foreignTaxCreditSpareLimitCarryforward`
 * 呼び出しは`actions.ts`の移行時に別途このリポジトリへ委譲する)
 */
import type { ForeignTaxCreditSpareLimitCarryforward } from "@prisma/client";
import { prisma } from "../db";

export interface ForeignTaxCreditSpareLimitCarryforwardRepository {
  findByTaxYearId(taxYearId: number): Promise<ForeignTaxCreditSpareLimitCarryforward[]>;
}

export function createPrismaForeignTaxCreditSpareLimitCarryforwardRepository(): ForeignTaxCreditSpareLimitCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<ForeignTaxCreditSpareLimitCarryforward[]> {
      return prisma.foreignTaxCreditSpareLimitCarryforward.findMany({
        where: { taxYearId },
        orderBy: { originYear: "asc" },
      });
    },
  };
}
