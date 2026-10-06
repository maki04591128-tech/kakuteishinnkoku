/**
 * フェーズ5-1-3b: `AssetSymbolMappingRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientAssetSymbolMappingRepository`。
 * `assetSymbolMappingRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで`@/lib/repositories/defaultAssetSymbolMappingRepository`を
 * `defaultAssetSymbolMappingRepository.standalone.ts`に差し替えた際、このファイル
 * (と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { AssetSymbolMappingRepository } from "./assetSymbolMappingRepository";
import type { AssetSymbolMapping } from "@prisma/client";

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
