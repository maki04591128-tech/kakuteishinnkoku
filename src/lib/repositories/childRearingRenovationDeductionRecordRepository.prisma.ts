/**
 * フェーズ5-1-3b: `ChildRearingRenovationDeductionRecordRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientChildRearingRenovationDeductionRecordRepository`。
 * `childRearingRenovationDeductionRecordRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultChildRearingRenovationDeductionRecordRepository`を
 * `defaultChildRearingRenovationDeductionRecordRepository.standalone.ts`に差し替えた際、
 * このファイル(と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { ChildRearingRenovationDeductionRecordRepository } from "./childRearingRenovationDeductionRecordRepository";
import type { ChildRearingRenovationDeductionRecord } from "@prisma/client";

export function createPrismaChildRearingRenovationDeductionRecordRepository(): ChildRearingRenovationDeductionRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<ChildRearingRenovationDeductionRecord | null> {
      return prisma.childRearingRenovationDeductionRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      await prisma.childRearingRenovationDeductionRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, creditJpy },
        update: { creditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.childRearingRenovationDeductionRecord.deleteMany({ where: { taxYearId } });
    },
  };
}
