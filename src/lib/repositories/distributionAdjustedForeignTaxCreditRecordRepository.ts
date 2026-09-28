/**
 * フェーズ1(リポジトリパターン導入): `src/lib/investment/distributionAdjustedForeignTaxCredit.ts`が
 * 直接`prisma.distributionAdjustedForeignTaxCreditRecord`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { DistributionAdjustedForeignTaxCreditRecord } from "@prisma/client";
import { prisma } from "../db";

export interface DistributionAdjustedForeignTaxCreditRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<DistributionAdjustedForeignTaxCreditRecord | null>;
}

export function createPrismaDistributionAdjustedForeignTaxCreditRecordRepository(): DistributionAdjustedForeignTaxCreditRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<DistributionAdjustedForeignTaxCreditRecord | null> {
      return prisma.distributionAdjustedForeignTaxCreditRecord.findUnique({
        where: { taxYearId },
      });
    },
  };
}
