/**
 * フェーズ5-1-3b: `DurabilityImprovementRenovationDeductionRecordRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientDurabilityImprovementRenovationDeductionRecordRepository`。
 * `durabilityImprovementRenovationDeductionRecordRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultDurabilityImprovementRenovationDeductionRecordRepository`を
 * `defaultDurabilityImprovementRenovationDeductionRecordRepository.standalone.ts`に差し替えた際、
 * このファイル(と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { DurabilityImprovementRenovationDeductionRecordRepository } from "./durabilityImprovementRenovationDeductionRecordRepository";
import type { DurabilityImprovementRenovationDeductionRecord } from "@prisma/client";

export function createPrismaDurabilityImprovementRenovationDeductionRecordRepository(): DurabilityImprovementRenovationDeductionRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<DurabilityImprovementRenovationDeductionRecord | null> {
      return prisma.durabilityImprovementRenovationDeductionRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      await prisma.durabilityImprovementRenovationDeductionRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, creditJpy },
        update: { creditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.durabilityImprovementRenovationDeductionRecord.deleteMany({
        where: { taxYearId },
      });
    },
  };
}
