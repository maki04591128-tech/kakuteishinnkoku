/**
 * フェーズ1(リポジトリパターン導入): `src/lib/multiHouseholdRenovationDeduction.ts`が直接
 * `prisma.multiHouseholdRenovationDeductionRecord`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { MultiHouseholdRenovationDeductionRecord } from "@prisma/client";
import { prisma } from "../db";

export interface MultiHouseholdRenovationDeductionRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<MultiHouseholdRenovationDeductionRecord | null>;
}

export function createPrismaMultiHouseholdRenovationDeductionRecordRepository(): MultiHouseholdRenovationDeductionRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<MultiHouseholdRenovationDeductionRecord | null> {
      return prisma.multiHouseholdRenovationDeductionRecord.findUnique({ where: { taxYearId } });
    },
  };
}
