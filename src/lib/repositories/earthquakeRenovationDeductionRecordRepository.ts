/**
 * フェーズ1(リポジトリパターン導入): `src/lib/earthquakeRenovationDeduction.ts`が直接
 * `prisma.earthquakeRenovationDeductionRecord`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { EarthquakeRenovationDeductionRecord } from "@prisma/client";
import { prisma } from "../db";

export interface EarthquakeRenovationDeductionRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<EarthquakeRenovationDeductionRecord | null>;
  upsert(params: { taxYearId: number; creditJpy: string }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

export function createPrismaEarthquakeRenovationDeductionRecordRepository(): EarthquakeRenovationDeductionRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<EarthquakeRenovationDeductionRecord | null> {
      return prisma.earthquakeRenovationDeductionRecord.findUnique({ where: { taxYearId } });
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      await prisma.earthquakeRenovationDeductionRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, creditJpy },
        update: { creditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.earthquakeRenovationDeductionRecord.deleteMany({ where: { taxYearId } });
    },
  };
}
