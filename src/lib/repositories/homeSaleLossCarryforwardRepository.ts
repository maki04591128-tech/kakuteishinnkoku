/**
 * フェーズ1(リポジトリパターン導入): `src/app/home-sale-loss-deduction/page.tsx`が
 * 直接`prisma.homeSaleLossCarryforward`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { HomeSaleLossCarryforward } from "@prisma/client";
import { prisma } from "../db";

export interface HomeSaleLossCarryforwardRepository {
  findByTaxYearId(taxYearId: number): Promise<HomeSaleLossCarryforward[]>;
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

export function createPrismaHomeSaleLossCarryforwardRepository(): HomeSaleLossCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<HomeSaleLossCarryforward[]> {
      return prisma.homeSaleLossCarryforward.findMany({
        where: { taxYearId },
        orderBy: { originYear: "asc" },
      });
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      await prisma.homeSaleLossCarryforward.upsert({
        where: {
          taxYearId_originYear: { taxYearId, originYear },
        },
        create: { taxYearId, originYear, remainingAmountJpy },
        update: { remainingAmountJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.homeSaleLossCarryforward.delete({ where: { id } });
    },

    async createMany(data): Promise<void> {
      if (data.length === 0) return;
      await prisma.homeSaleLossCarryforward.createMany({ data });
    },
  };
}
