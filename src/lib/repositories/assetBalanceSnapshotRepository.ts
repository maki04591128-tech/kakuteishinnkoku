/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`・`src/app/actions.ts`が
 * 直接`prisma.assetBalanceSnapshot`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { AssetBalanceSnapshot } from "@prisma/client";
import { prisma } from "../db";

export interface AssetBalanceSnapshotImportRow {
  snapshotDate: Date | null;
  category: string;
  institution: string;
  assetName: string;
  balanceJpy: string;
  quantity: string | null;
}

export interface AssetBalanceSnapshotRepository {
  findByTaxYearId(taxYearId: number): Promise<AssetBalanceSnapshot[]>;
  importCsvBatch(input: {
    taxYearId: number;
    sourceType: string;
    fileName: string;
    rows: AssetBalanceSnapshotImportRow[];
  }): Promise<void>;
  deleteImportBatch(importBatchId: number): Promise<void>;
}

export function createPrismaAssetBalanceSnapshotRepository(): AssetBalanceSnapshotRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<AssetBalanceSnapshot[]> {
      return prisma.assetBalanceSnapshot.findMany({ where: { taxYearId } });
    },

    async importCsvBatch({ taxYearId, sourceType, fileName, rows }): Promise<void> {
      await prisma.$transaction(async (tx) => {
        const batch = await tx.importBatch.create({
          data: {
            taxYearId,
            sourceType,
            fileName,
            rowCount: rows.length,
          },
        });

        if (rows.length > 0) {
          await tx.assetBalanceSnapshot.createMany({
            data: rows.map((row) => ({
              taxYearId,
              ...(row.snapshotDate ? { snapshotDate: row.snapshotDate } : {}),
              category: row.category,
              institution: row.institution,
              assetName: row.assetName,
              balanceJpy: row.balanceJpy,
              quantity: row.quantity,
              importBatchId: batch.id,
            })),
          });
        }
      });
    },

    async deleteImportBatch(importBatchId: number): Promise<void> {
      await prisma.$transaction([
        prisma.assetBalanceSnapshot.deleteMany({ where: { importBatchId } }),
        prisma.importBatch.delete({ where: { id: importBatchId } }),
      ]);
    },
  };
}
