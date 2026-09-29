/**
 * フェーズ1(リポジトリパターン導入): `src/app/foreign-tax-credit/page.tsx`・
 * `src/app/actions.ts`が直接`prisma.foreignTaxCreditSpareLimitCarryforward`を
 * 呼んでいた処理をこのインターフェース経由に置き換える。挙動は既存のPrisma実装と
 * 完全に一致させる。
 */
import type { ForeignTaxCreditSpareLimitCarryforward } from "@prisma/client";
import { prisma } from "../db";

export interface ForeignTaxCreditSpareLimitCarryforwardRepository {
  findByTaxYearId(taxYearId: number): Promise<ForeignTaxCreditSpareLimitCarryforward[]>;
  upsert(params: {
    taxYearId: number;
    originYear: number;
    remainingAmountJpy: string;
  }): Promise<void>;
  delete(id: number): Promise<void>;
  createMany(
    data: Array<{ taxYearId: number; originYear: number; remainingAmountJpy: string }>,
  ): Promise<void>;
}

export function createPrismaForeignTaxCreditSpareLimitCarryforwardRepository(): ForeignTaxCreditSpareLimitCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<ForeignTaxCreditSpareLimitCarryforward[]> {
      return prisma.foreignTaxCreditSpareLimitCarryforward.findMany({
        where: { taxYearId },
        orderBy: { originYear: "asc" },
      });
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      await prisma.foreignTaxCreditSpareLimitCarryforward.upsert({
        where: {
          taxYearId_originYear: { taxYearId, originYear },
        },
        create: { taxYearId, originYear, remainingAmountJpy },
        update: { remainingAmountJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.foreignTaxCreditSpareLimitCarryforward.delete({ where: { id } });
    },

    async createMany(data): Promise<void> {
      if (data.length === 0) return;
      await prisma.foreignTaxCreditSpareLimitCarryforward.createMany({ data });
    },
  };
}
