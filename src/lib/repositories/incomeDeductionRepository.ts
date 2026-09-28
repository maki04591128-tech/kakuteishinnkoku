/**
 * フェーズ1(リポジトリパターン導入): `src/lib/incomeDeduction.ts`が直接
 * `prisma.incomeDeduction`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { IncomeDeduction } from "@prisma/client";
import { prisma } from "../db";

export interface IncomeDeductionRepository {
  findByTaxYearId(taxYearId: number): Promise<IncomeDeduction[]>;
}

export function createPrismaIncomeDeductionRepository(): IncomeDeductionRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<IncomeDeduction[]> {
      return prisma.incomeDeduction.findMany({
        where: { taxYearId },
      });
    },
  };
}
