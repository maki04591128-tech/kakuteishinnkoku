/**
 * フェーズ1(リポジトリパターン導入): `src/lib/certifiedHousingConstructionCredit.ts`が
 * 直接`prisma.certifiedHousingConstructionCreditCarryforward`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { CertifiedHousingConstructionCreditCarryforward } from "@prisma/client";
import { prisma } from "../db";

export interface CertifiedHousingConstructionCreditCarryforwardRepository {
  findByTaxYearId(
    taxYearId: number,
  ): Promise<CertifiedHousingConstructionCreditCarryforward | null>;
  upsert(params: { taxYearId: number; originYear: number; remainingAmountJpy: string }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

export function createPrismaCertifiedHousingConstructionCreditCarryforwardRepository(): CertifiedHousingConstructionCreditCarryforwardRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<CertifiedHousingConstructionCreditCarryforward | null> {
      return prisma.certifiedHousingConstructionCreditCarryforward.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      await prisma.certifiedHousingConstructionCreditCarryforward.upsert({
        where: { taxYearId },
        create: { taxYearId, originYear, remainingAmountJpy },
        update: { originYear, remainingAmountJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.certifiedHousingConstructionCreditCarryforward.deleteMany({
        where: { taxYearId },
      });
    },
  };
}
