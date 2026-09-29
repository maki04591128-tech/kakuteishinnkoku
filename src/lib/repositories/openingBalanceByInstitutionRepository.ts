/**
 * フェーズ1(リポジトリパターン導入): `src/app/actions.ts`が直接
 * `prisma.openingBalanceByInstitution`を呼んでいた処理をこのインターフェース
 * 経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/import/page.tsx`側の`prisma.openingBalanceByInstitution`呼び出しは
 * 移行時に別途このリポジトリへ委譲する)
 */
import type { OpeningBalanceAssetClass } from "@prisma/client";
import { prisma } from "../db";

export interface OpeningBalanceByInstitutionRepository {
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
