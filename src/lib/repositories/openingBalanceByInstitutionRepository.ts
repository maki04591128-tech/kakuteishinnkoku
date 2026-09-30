/**
 * フェーズ1(リポジトリパターン導入): `src/app/actions.ts`・
 * `src/app/import/page.tsx`が直接`prisma.openingBalanceByInstitution`を
 * 呼んでいた処理をこのインターフェース経由に置き換える。挙動は既存の
 * Prisma実装と完全に一致させる。
 */
import type {
  OpeningBalanceAssetClass,
  OpeningBalanceByInstitution,
} from "@prisma/client";
import { prisma } from "../db";

export interface OpeningBalanceByInstitutionRepository {
  findByTaxYearId(
    taxYearId: number,
  ): Promise<OpeningBalanceByInstitution[]>;
  upsert(params: {
    taxYearId: number;
    assetClass: OpeningBalanceAssetClass;
    symbol: string;
    institution: string;
    quantity: string;
  }): Promise<void>;
  delete(id: number): Promise<void>;
}

export function createPrismaOpeningBalanceByInstitutionRepository(): OpeningBalanceByInstitutionRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<OpeningBalanceByInstitution[]> {
      return prisma.openingBalanceByInstitution.findMany({
        where: { taxYearId },
      });
    },

    async upsert({
      taxYearId,
      assetClass,
      symbol,
      institution,
      quantity,
    }): Promise<void> {
      await prisma.openingBalanceByInstitution.upsert({
        where: {
          taxYearId_assetClass_symbol_institution: {
            taxYearId,
            assetClass,
            symbol,
            institution,
          },
        },
        create: { taxYearId, assetClass, symbol, institution, quantity },
        update: { quantity },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.openingBalanceByInstitution.delete({ where: { id } });
    },
  };
}
