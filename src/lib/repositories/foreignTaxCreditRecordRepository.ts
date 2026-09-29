/**
 * フェーズ1(リポジトリパターン導入): `src/lib/investment/foreignTaxCredit.ts`が直接
 * `prisma.foreignTaxCreditRecord`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { ForeignTaxCreditRecord } from "@prisma/client";
import { prisma } from "../db";

export interface ForeignTaxCreditRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<ForeignTaxCreditRecord | null>;
  upsert(params: {
    taxYearId: number;
    totalCreditJpy: string;
    nationalTaxCreditJpy: string;
    residentTaxCreditJpy: string;
  }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

export function createPrismaForeignTaxCreditRecordRepository(): ForeignTaxCreditRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<ForeignTaxCreditRecord | null> {
      return prisma.foreignTaxCreditRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({
      taxYearId,
      totalCreditJpy,
      nationalTaxCreditJpy,
      residentTaxCreditJpy,
    }): Promise<void> {
      await prisma.foreignTaxCreditRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, totalCreditJpy, nationalTaxCreditJpy, residentTaxCreditJpy },
        update: { totalCreditJpy, nationalTaxCreditJpy, residentTaxCreditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.foreignTaxCreditRecord.deleteMany({ where: { taxYearId } });
    },
  };
}
