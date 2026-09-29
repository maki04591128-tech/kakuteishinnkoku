/**
 * フェーズ1(リポジトリパターン導入): `src/lib/mortgageDeduction.ts`が直接
 * `prisma.mortgageDeductionRecord`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { MortgageDeductionRecord } from "@prisma/client";
import { prisma } from "../db";

export interface MortgageDeductionRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<MortgageDeductionRecord | null>;
  upsert(params: {
    taxYearId: number;
    nationalTaxCreditJpy: string;
    residentTaxCreditJpy: string;
  }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

export function createPrismaMortgageDeductionRecordRepository(): MortgageDeductionRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<MortgageDeductionRecord | null> {
      return prisma.mortgageDeductionRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, nationalTaxCreditJpy, residentTaxCreditJpy }): Promise<void> {
      await prisma.mortgageDeductionRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, nationalTaxCreditJpy, residentTaxCreditJpy },
        update: { nationalTaxCreditJpy, residentTaxCreditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.mortgageDeductionRecord.deleteMany({ where: { taxYearId } });
    },
  };
}
