/**
 * フェーズ1(リポジトリパターン導入): `src/app/foreign-tax-credit/page.tsx`・
 * `src/app/actions.ts`が直接`prisma.foreignTaxCreditCarryforward`を呼んでいた
 * 処理をこのインターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { ForeignTaxCreditCarryforward } from "@prisma/client";
import { prisma } from "../db";

export interface ForeignTaxCreditCarryforwardRepository {
  findByTaxYearId(taxYearId: number): Promise<ForeignTaxCreditCarryforward[]>;
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

export function createPrismaForeignTaxCreditCarryforwardRepository(): ForeignTaxCreditCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<ForeignTaxCreditCarryforward[]> {
      return prisma.foreignTaxCreditCarryforward.findMany({
        where: { taxYearId },
        orderBy: { originYear: "asc" },
      });
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      await prisma.foreignTaxCreditCarryforward.upsert({
        where: {
          taxYearId_originYear: { taxYearId, originYear },
        },
        create: { taxYearId, originYear, remainingAmountJpy },
        update: { remainingAmountJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.foreignTaxCreditCarryforward.delete({ where: { id } });
    },

    async createMany(data): Promise<void> {
      if (data.length === 0) return;
      await prisma.foreignTaxCreditCarryforward.createMany({ data });
    },
  };
}
