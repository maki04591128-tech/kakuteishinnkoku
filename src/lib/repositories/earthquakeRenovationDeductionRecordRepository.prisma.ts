/**
 * フェーズ5-1-3b: `EarthquakeRenovationDeductionRecordRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientEarthquakeRenovationDeductionRecordRepository`。
 * `earthquakeRenovationDeductionRecordRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultEarthquakeRenovationDeductionRecordRepository`を
 * `defaultEarthquakeRenovationDeductionRecordRepository.standalone.ts`に差し替えた際、
 * このファイル(と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { EarthquakeRenovationDeductionRecordRepository } from "./earthquakeRenovationDeductionRecordRepository";
import type { EarthquakeRenovationDeductionRecord } from "@prisma/client";

export function createPrismaEarthquakeRenovationDeductionRecordRepository(): EarthquakeRenovationDeductionRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<EarthquakeRenovationDeductionRecord | null> {
      return prisma.earthquakeRenovationDeductionRecord.findUnique({ where: { taxYearId } });
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      await prisma.earthquakeRenovationDeductionRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, creditJpy },
        update: { creditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.earthquakeRenovationDeductionRecord.deleteMany({ where: { taxYearId } });
    },
  };
}
