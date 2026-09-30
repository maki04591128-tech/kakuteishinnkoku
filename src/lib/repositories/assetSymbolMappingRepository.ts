/**
 * フェーズ1(リポジトリパターン導入): `src/app/actions.ts`・
 * `src/app/import/page.tsx`が直接`prisma.assetSymbolMapping`を呼んでいた
 * 処理をこのインターフェース経由に置き換える。挙動は既存のPrisma実装と
 * 完全に一致させる。
 */
import type { AssetSymbolMapping } from "@prisma/client";
import { prisma } from "../db";

export interface AssetSymbolMappingRepository {
  findMany(): Promise<AssetSymbolMapping[]>;
  upsert(params: { assetName: string; symbol: string }): Promise<void>;
  delete(id: number): Promise<void>;
}

export function createPrismaAssetSymbolMappingRepository(): AssetSymbolMappingRepository {
  return {
    async findMany(): Promise<AssetSymbolMapping[]> {
      return prisma.assetSymbolMapping.findMany({ orderBy: { assetName: "asc" } });
    },

    async upsert({ assetName, symbol }): Promise<void> {
      await prisma.assetSymbolMapping.upsert({
        where: { assetName },
        create: { assetName, symbol },
        update: { symbol },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.assetSymbolMapping.delete({ where: { id } });
    },
  };
}
