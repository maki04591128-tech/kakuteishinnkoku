/**
 * フェーズ1(リポジトリパターン導入): `src/lib/certifiedHousingConstructionCredit.ts`が
 * 直接`prisma.certifiedHousingConstructionCreditRecord`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { CertifiedHousingConstructionCreditRecord } from "@prisma/client";
import { prisma } from "../db";

export interface CertifiedHousingConstructionCreditRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<CertifiedHousingConstructionCreditRecord | null>;
  upsert(params: { taxYearId: number; creditJpy: string }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

export function createPrismaCertifiedHousingConstructionCreditRecordRepository(): CertifiedHousingConstructionCreditRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<CertifiedHousingConstructionCreditRecord | null> {
      return prisma.certifiedHousingConstructionCreditRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      await prisma.certifiedHousingConstructionCreditRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, creditJpy },
        update: { creditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.certifiedHousingConstructionCreditRecord.deleteMany({ where: { taxYearId } });
    },
  };
}
