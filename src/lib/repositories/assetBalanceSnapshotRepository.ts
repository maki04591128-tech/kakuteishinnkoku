/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`が直接
 * `prisma.assetBalanceSnapshot`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/actions.ts`側の`prisma.assetBalanceSnapshot`呼び出しは
 * `actions.ts`の移行時に別途このリポジトリへ委譲する)
 */
import type { AssetBalanceSnapshot } from "@prisma/client";
import { prisma } from "../db";

export interface AssetBalanceSnapshotRepository {
  findByTaxYearId(taxYearId: number): Promise<AssetBalanceSnapshot[]>;
}

export function createPrismaAssetBalanceSnapshotRepository(): AssetBalanceSnapshotRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<AssetBalanceSnapshot[]> {
      return prisma.assetBalanceSnapshot.findMany({ where: { taxYearId } });
    },
  };
}
