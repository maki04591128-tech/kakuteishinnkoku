/**
 * フェーズ1(リポジトリパターン導入): `src/app/actions.ts`が直接
 * `prisma.assetSymbolMapping`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/import/page.tsx`側の`prisma.assetSymbolMapping`呼び出しは
 * `import/page.tsx`の移行時に別途このリポジトリへ委譲する)
 */
import { prisma } from "../db";

export interface AssetSymbolMappingRepository {
  upsert(params: { assetName: string; symbol: string }): Promise<void>;
  delete(id: number): Promise<void>;
}

export function createPrismaAssetSymbolMappingRepository(): AssetSymbolMappingRepository {
  return {
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
