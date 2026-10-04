/**
 * フェーズ5-1-3b: `ForeignTaxCreditRecordRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientForeignTaxCreditRecordRepository`。
 * `foreignTaxCreditRecordRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで`@/lib/repositories/defaultForeignTaxCreditRecordRepository`を
 * `defaultForeignTaxCreditRecordRepository.standalone.ts`に差し替えた際、このファイル
 * (と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { ForeignTaxCreditRecordRepository } from "./foreignTaxCreditRecordRepository";
import type { ForeignTaxCreditRecord } from "@prisma/client";

export function createPrismaForeignTaxCreditRecordRepository(): ForeignTaxCreditRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<ForeignTaxCreditRecord | null> {
      return prisma.foreignTaxCreditRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({
      taxYearId,
      totalCreditJpy,
      nationalTaxCreditJpy,
      residentTaxCreditJpy,
    }): Promise<void> {
      await prisma.foreignTaxCreditRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, totalCreditJpy, nationalTaxCreditJpy, residentTaxCreditJpy },
        update: { totalCreditJpy, nationalTaxCreditJpy, residentTaxCreditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.foreignTaxCreditRecord.deleteMany({ where: { taxYearId } });
    },
  };
}
