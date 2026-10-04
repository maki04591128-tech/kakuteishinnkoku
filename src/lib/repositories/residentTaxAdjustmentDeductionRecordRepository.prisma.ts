/**
 * フェーズ5-1-3b: `ResidentTaxAdjustmentDeductionRecordRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientResidentTaxAdjustmentDeductionRecordRepository`。
 * `residentTaxAdjustmentDeductionRecordRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultResidentTaxAdjustmentDeductionRecordRepository`を
 * `defaultResidentTaxAdjustmentDeductionRecordRepository.standalone.ts`に差し替えた際、
 * このファイル(と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { ResidentTaxAdjustmentDeductionRecordRepository } from "./residentTaxAdjustmentDeductionRecordRepository";
import type { ResidentTaxAdjustmentDeductionRecord } from "@prisma/client";

export function createPrismaResidentTaxAdjustmentDeductionRecordRepository(): ResidentTaxAdjustmentDeductionRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<ResidentTaxAdjustmentDeductionRecord | null> {
      return prisma.residentTaxAdjustmentDeductionRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, adjustmentDeductionJpy }): Promise<void> {
      await prisma.residentTaxAdjustmentDeductionRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, adjustmentDeductionJpy },
        update: { adjustmentDeductionJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.residentTaxAdjustmentDeductionRecord.deleteMany({ where: { taxYearId } });
    },
  };
}
