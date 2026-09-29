/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`・`src/app/actions.ts`が
 * 直接`prisma.investmentLossCarryforward`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/import/page.tsx`側の`prisma.investmentLossCarryforward`呼び出しは
 * 移行時に別途このリポジトリへ委譲する)
 */
import type { InvestmentLossCarryforward } from "@prisma/client";
import { prisma } from "../db";

export interface InvestmentLossCarryforwardRepository {
  findByTaxYearId(taxYearId: number): Promise<InvestmentLossCarryforward[]>;
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

export function createPrismaInvestmentLossCarryforwardRepository(): InvestmentLossCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<InvestmentLossCarryforward[]> {
      return prisma.investmentLossCarryforward.findMany({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      await prisma.investmentLossCarryforward.upsert({
        where: {
          taxYearId_originYear: { taxYearId, originYear },
        },
        create: { taxYearId, originYear, remainingAmountJpy },
        update: { remainingAmountJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.investmentLossCarryforward.delete({ where: { id } });
    },

    async createMany(data): Promise<void> {
      if (data.length === 0) return;
      await prisma.investmentLossCarryforward.createMany({ data });
    },
  };
}
