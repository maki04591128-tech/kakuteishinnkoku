/**
 * フェーズ5-1-3b: `BarrierFreeRenovationDeductionRecordRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientBarrierFreeRenovationDeductionRecordRepository`。
 * `barrierFreeRenovationDeductionRecordRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultBarrierFreeRenovationDeductionRecordRepository`を
 * `defaultBarrierFreeRenovationDeductionRecordRepository.standalone.ts`に差し替えた際、
 * このファイル(と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { BarrierFreeRenovationDeductionRecordRepository } from "./barrierFreeRenovationDeductionRecordRepository";
import type { BarrierFreeRenovationDeductionRecord } from "@prisma/client";

export function createPrismaBarrierFreeRenovationDeductionRecordRepository(): BarrierFreeRenovationDeductionRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<BarrierFreeRenovationDeductionRecord | null> {
      return prisma.barrierFreeRenovationDeductionRecord.findUnique({ where: { taxYearId } });
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      await prisma.barrierFreeRenovationDeductionRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, creditJpy },
        update: { creditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.barrierFreeRenovationDeductionRecord.deleteMany({ where: { taxYearId } });
    },
  };
}
