/**
 * フェーズ1(リポジトリパターン導入): `src/lib/openingBalance.ts`・
 * `src/app/actions.ts`が直接`prisma.openingBalance`を呼んでいた処理を
 * このインターフェース経由に置き換える。挙動は既存のPrisma実装と完全に
 * 一致させる。(`src/app/import/page.tsx`側の`prisma.openingBalance`
 * 呼び出しは移行時に別途このリポジトリへ委譲する)
 */
import type { OpeningBalance, OpeningBalanceAssetClass } from "@prisma/client";
import { prisma } from "../db";

export interface OpeningBalanceRepository {
  findByTaxYearId(taxYearId: number): Promise<OpeningBalance[]>;
  upsert(params: {
    taxYearId: number;
    assetClass: OpeningBalanceAssetClass;
    symbol: string;
    isNisa: boolean;
    isListed: boolean;
    quantity: string;
    costBasisJpy: string;
  }): Promise<void>;
  delete(id: number): Promise<void>;
  createMany(
    data: Array<{
      taxYearId: number;
      assetClass: OpeningBalanceAssetClass;
      symbol: string;
      isNisa: boolean;
      isListed: boolean;
      quantity: string;
      costBasisJpy: string;
    }>,
  ): Promise<void>;
}

export function createPrismaOpeningBalanceRepository(): OpeningBalanceRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<OpeningBalance[]> {
      return prisma.openingBalance.findMany({ where: { taxYearId } });
    },

    async upsert({
      taxYearId,
      assetClass,
      symbol,
      isNisa,
      isListed,
      quantity,
      costBasisJpy,
    }): Promise<void> {
      await prisma.openingBalance.upsert({
        where: {
          taxYearId_assetClass_symbol_isNisa_isListed: {
            taxYearId,
            assetClass,
            symbol,
            isNisa,
            isListed,
          },
        },
        create: {
          taxYearId,
          assetClass,
          symbol,
          isNisa,
          isListed,
          quantity,
          costBasisJpy,
        },
        update: { quantity, costBasisJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.openingBalance.delete({ where: { id } });
    },

    async createMany(data): Promise<void> {
      if (data.length === 0) return;
      await prisma.openingBalance.createMany({ data });
    },
  };
}
