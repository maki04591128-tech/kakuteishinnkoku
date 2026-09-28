/**
 * フェーズ1(リポジトリパターン導入): `src/lib/durabilityImprovementRenovationDeduction.ts`が
 * 直接`prisma.durabilityImprovementRenovationDeductionRecord`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { DurabilityImprovementRenovationDeductionRecord } from "@prisma/client";
import { prisma } from "../db";

export interface DurabilityImprovementRenovationDeductionRecordRepository {
  findByTaxYearId(
    taxYearId: number,
  ): Promise<DurabilityImprovementRenovationDeductionRecord | null>;
}

export function createPrismaDurabilityImprovementRenovationDeductionRecordRepository(): DurabilityImprovementRenovationDeductionRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<DurabilityImprovementRenovationDeductionRecord | null> {
      return prisma.durabilityImprovementRenovationDeductionRecord.findUnique({
        where: { taxYearId },
      });
    },
  };
}
