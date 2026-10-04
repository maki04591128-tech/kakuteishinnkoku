/**
 * フェーズ5-1-3b: `AssetBalanceSnapshotRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientAssetBalanceSnapshotRepository`。
 * `assetBalanceSnapshotRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultAssetBalanceSnapshotRepository`を
 * `defaultAssetBalanceSnapshotRepository.standalone.ts`に差し替えた際、
 * このファイル(と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { AssetBalanceSnapshotRepository } from "./assetBalanceSnapshotRepository";

export function createPrismaAssetBalanceSnapshotRepository(): AssetBalanceSnapshotRepository {
  return {
    async findByTaxYearId(taxYearId: number) {
      return prisma.assetBalanceSnapshot.findMany({ where: { taxYearId } });
    },

    async findImportBatchesWithSnapshots({ taxYearId, sourceType }) {
      return prisma.importBatch.findMany({
        where: { taxYearId, sourceType },
        orderBy: { importedAt: "desc" },
        include: {
          assetBalanceSnapshots: {
            orderBy: [{ institution: "asc" }, { assetName: "asc" }],
          },
        },
      });
    },

    async importCsvBatch({ taxYearId, sourceType, fileName, rows }) {
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
