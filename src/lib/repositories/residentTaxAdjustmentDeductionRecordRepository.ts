/**
 * フェーズ1(リポジトリパターン導入): `src/lib/residentTaxAdjustmentDeduction.ts`が
 * 直接`prisma.residentTaxAdjustmentDeductionRecord`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { ResidentTaxAdjustmentDeductionRecord } from "@prisma/client";
import { prisma } from "../db";

export interface ResidentTaxAdjustmentDeductionRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<ResidentTaxAdjustmentDeductionRecord | null>;
}

export function createPrismaResidentTaxAdjustmentDeductionRecordRepository(): ResidentTaxAdjustmentDeductionRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<ResidentTaxAdjustmentDeductionRecord | null> {
      return prisma.residentTaxAdjustmentDeductionRecord.findUnique({
        where: { taxYearId },
      });
    },
  };
}
