/**
 * フェーズ1(リポジトリパターン導入): `src/lib/childRearingRenovationDeduction.ts`が
 * 直接`prisma.childRearingRenovationDeductionRecord`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { ChildRearingRenovationDeductionRecord } from "@prisma/client";
import { prisma } from "../db";

export interface ChildRearingRenovationDeductionRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<ChildRearingRenovationDeductionRecord | null>;
  upsert(params: { taxYearId: number; creditJpy: string }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

export function createPrismaChildRearingRenovationDeductionRecordRepository(): ChildRearingRenovationDeductionRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<ChildRearingRenovationDeductionRecord | null> {
      return prisma.childRearingRenovationDeductionRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      await prisma.childRearingRenovationDeductionRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, creditJpy },
        update: { creditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.childRearingRenovationDeductionRecord.deleteMany({ where: { taxYearId } });
    },
  };
}
