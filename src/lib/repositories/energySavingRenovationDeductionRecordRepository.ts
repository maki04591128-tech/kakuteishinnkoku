/**
 * フェーズ1(リポジトリパターン導入): `src/lib/energySavingRenovationDeduction.ts`が直接
 * `prisma.energySavingRenovationDeductionRecord`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { EnergySavingRenovationDeductionRecord } from "@prisma/client";
import { prisma } from "../db";

export interface EnergySavingRenovationDeductionRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<EnergySavingRenovationDeductionRecord | null>;
  upsert(params: { taxYearId: number; creditJpy: string }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

export function createPrismaEnergySavingRenovationDeductionRecordRepository(): EnergySavingRenovationDeductionRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<EnergySavingRenovationDeductionRecord | null> {
      return prisma.energySavingRenovationDeductionRecord.findUnique({ where: { taxYearId } });
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      await prisma.energySavingRenovationDeductionRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, creditJpy },
        update: { creditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.energySavingRenovationDeductionRecord.deleteMany({ where: { taxYearId } });
    },
  };
}
