/**
 * フェーズ5-1-3b: `EnergySavingRenovationDeductionRecordRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientEnergySavingRenovationDeductionRecordRepository`。
 * `energySavingRenovationDeductionRecordRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultEnergySavingRenovationDeductionRecordRepository`を
 * `defaultEnergySavingRenovationDeductionRecordRepository.standalone.ts`に差し替えた際、
 * このファイル(と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { EnergySavingRenovationDeductionRecordRepository } from "./energySavingRenovationDeductionRecordRepository";
import type { EnergySavingRenovationDeductionRecord } from "@prisma/client";

export function createPrismaEnergySavingRenovationDeductionRecordRepository(): EnergySavingRenovationDeductionRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<EnergySavingRenovationDeductionRecord | null> {
      return prisma.energySavingRenovationDeductionRecord.findUnique({ where: { taxYearId } });
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      await prisma.energySavingRenovationDeductionRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, creditJpy },
        update: { creditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.energySavingRenovationDeductionRecord.deleteMany({ where: { taxYearId } });
    },
  };
}
