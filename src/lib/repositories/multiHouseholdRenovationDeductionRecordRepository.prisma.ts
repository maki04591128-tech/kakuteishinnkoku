/**
 * フェーズ5-1-3b: `MultiHouseholdRenovationDeductionRecordRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientMultiHouseholdRenovationDeductionRecordRepository`。
 * `multiHouseholdRenovationDeductionRecordRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultMultiHouseholdRenovationDeductionRecordRepository`を
 * `defaultMultiHouseholdRenovationDeductionRecordRepository.standalone.ts`に差し替えた際、
 * このファイル(と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { MultiHouseholdRenovationDeductionRecordRepository } from "./multiHouseholdRenovationDeductionRecordRepository";
import type { MultiHouseholdRenovationDeductionRecord } from "@prisma/client";

export function createPrismaMultiHouseholdRenovationDeductionRecordRepository(): MultiHouseholdRenovationDeductionRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<MultiHouseholdRenovationDeductionRecord | null> {
      return prisma.multiHouseholdRenovationDeductionRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      await prisma.multiHouseholdRenovationDeductionRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, creditJpy },
        update: { creditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.multiHouseholdRenovationDeductionRecord.deleteMany({
        where: { taxYearId },
      });
    },
  };
}
