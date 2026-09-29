/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`が直接
 * `prisma.nisaLifetimeQuota`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/actions.ts`・`src/app/import/page.tsx`側の`prisma.nisaLifetimeQuota`
 * 呼び出しはそれぞれの移行時に別途このリポジトリへ委譲する)
 */
import type { InvestmentNisaType, NisaLifetimeQuota } from "@prisma/client";
import { prisma } from "../db";

export interface NisaLifetimeQuotaRepository {
  findByTaxYearId(taxYearId: number): Promise<NisaLifetimeQuota[]>;
  upsert(params: {
    taxYearId: number;
    nisaType: InvestmentNisaType;
    openingUsedJpy: string;
    soldCostBasisJpy: string;
  }): Promise<void>;
  delete(id: number): Promise<void>;
  createMany(
    data: Array<{
      taxYearId: number;
      nisaType: InvestmentNisaType;
      openingUsedJpy: string;
    }>,
  ): Promise<void>;
}

export function createPrismaNisaLifetimeQuotaRepository(): NisaLifetimeQuotaRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<NisaLifetimeQuota[]> {
      return prisma.nisaLifetimeQuota.findMany({ where: { taxYearId } });
    },

    async upsert({
      taxYearId,
      nisaType,
      openingUsedJpy,
      soldCostBasisJpy,
    }): Promise<void> {
      await prisma.nisaLifetimeQuota.upsert({
        where: {
          taxYearId_nisaType: { taxYearId, nisaType },
        },
        create: { taxYearId, nisaType, openingUsedJpy, soldCostBasisJpy },
        update: { openingUsedJpy, soldCostBasisJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.nisaLifetimeQuota.delete({ where: { id } });
    },

    async createMany(data): Promise<void> {
      if (data.length === 0) return;
      await prisma.nisaLifetimeQuota.createMany({ data });
    },
  };
}
