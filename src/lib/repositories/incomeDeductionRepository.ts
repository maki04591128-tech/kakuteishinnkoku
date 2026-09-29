/**
 * フェーズ1(リポジトリパターン導入): `src/lib/incomeDeduction.ts`が直接
 * `prisma.incomeDeduction`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { IncomeDeduction, IncomeDeductionType } from "@prisma/client";
import { prisma } from "../db";

export interface IncomeDeductionRepository {
  findByTaxYearId(taxYearId: number): Promise<IncomeDeduction[]>;
  upsert(params: {
    taxYearId: number;
    type: IncomeDeductionType;
    incomeTaxAmountJpy: string;
    residentTaxAmountJpy: string;
  }): Promise<void>;
  deleteByTaxYearIdAndType(taxYearId: number, type: IncomeDeductionType): Promise<void>;
}

export function createPrismaIncomeDeductionRepository(): IncomeDeductionRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<IncomeDeduction[]> {
      return prisma.incomeDeduction.findMany({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, type, incomeTaxAmountJpy, residentTaxAmountJpy }): Promise<void> {
      await prisma.incomeDeduction.upsert({
        where: { taxYearId_type: { taxYearId, type } },
        create: { taxYearId, type, incomeTaxAmountJpy, residentTaxAmountJpy },
        update: { incomeTaxAmountJpy, residentTaxAmountJpy },
      });
    },

    async deleteByTaxYearIdAndType(taxYearId: number, type: IncomeDeductionType): Promise<void> {
      await prisma.incomeDeduction.deleteMany({ where: { taxYearId, type } });
    },
  };
}
