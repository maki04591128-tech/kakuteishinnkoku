/**
 * フェーズ1(リポジトリパターン導入): `src/lib/barrierFreeRenovationDeduction.ts`が直接
 * `prisma.barrierFreeRenovationDeductionRecord`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { BarrierFreeRenovationDeductionRecord } from "@prisma/client";
import { prisma } from "../db";

export interface BarrierFreeRenovationDeductionRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<BarrierFreeRenovationDeductionRecord | null>;
}

export function createPrismaBarrierFreeRenovationDeductionRecordRepository(): BarrierFreeRenovationDeductionRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<BarrierFreeRenovationDeductionRecord | null> {
      return prisma.barrierFreeRenovationDeductionRecord.findUnique({ where: { taxYearId } });
    },
  };
}
