/**
 * フェーズ1(リポジトリパターン導入): `src/lib/residentTaxAdjustmentDeduction.ts`が
 * 直接`prisma.residentTaxAdjustmentDeductionRecord`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { ResidentTaxAdjustmentDeductionRecord } from "@prisma/client";
import { prisma } from "../db";

export interface ResidentTaxAdjustmentDeductionRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<ResidentTaxAdjustmentDeductionRecord | null>;
  upsert(params: { taxYearId: number; adjustmentDeductionJpy: string }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

export function createPrismaResidentTaxAdjustmentDeductionRecordRepository(): ResidentTaxAdjustmentDeductionRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<ResidentTaxAdjustmentDeductionRecord | null> {
      return prisma.residentTaxAdjustmentDeductionRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, adjustmentDeductionJpy }): Promise<void> {
      await prisma.residentTaxAdjustmentDeductionRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, adjustmentDeductionJpy },
        update: { adjustmentDeductionJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.residentTaxAdjustmentDeductionRecord.deleteMany({ where: { taxYearId } });
    },
  };
}
