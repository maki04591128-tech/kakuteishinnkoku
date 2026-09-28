/**
 * フェーズ1(リポジトリパターン導入): `src/lib/earthquakeRenovationDeduction.ts`が直接
 * `prisma.earthquakeRenovationDeductionRecord`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { EarthquakeRenovationDeductionRecord } from "@prisma/client";
import { prisma } from "../db";

export interface EarthquakeRenovationDeductionRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<EarthquakeRenovationDeductionRecord | null>;
}

export function createPrismaEarthquakeRenovationDeductionRecordRepository(): EarthquakeRenovationDeductionRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<EarthquakeRenovationDeductionRecord | null> {
      return prisma.earthquakeRenovationDeductionRecord.findUnique({ where: { taxYearId } });
    },
  };
}
