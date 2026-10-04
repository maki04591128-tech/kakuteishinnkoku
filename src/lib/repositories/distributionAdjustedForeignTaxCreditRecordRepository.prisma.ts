/**
 * フェーズ5-1-3b: `DistributionAdjustedForeignTaxCreditRecordRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientDistributionAdjustedForeignTaxCreditRecordRepository`。
 * `distributionAdjustedForeignTaxCreditRecordRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultDistributionAdjustedForeignTaxCreditRecordRepository`を
 * `defaultDistributionAdjustedForeignTaxCreditRecordRepository.standalone.ts`に差し替えた際、
 * このファイル(と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { DistributionAdjustedForeignTaxCreditRecordRepository } from "./distributionAdjustedForeignTaxCreditRecordRepository";
import type { DistributionAdjustedForeignTaxCreditRecord } from "@prisma/client";

export function createPrismaDistributionAdjustedForeignTaxCreditRecordRepository(): DistributionAdjustedForeignTaxCreditRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<DistributionAdjustedForeignTaxCreditRecord | null> {
      return prisma.distributionAdjustedForeignTaxCreditRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      await prisma.distributionAdjustedForeignTaxCreditRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, creditJpy },
        update: { creditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.distributionAdjustedForeignTaxCreditRecord.deleteMany({ where: { taxYearId } });
    },
  };
}
