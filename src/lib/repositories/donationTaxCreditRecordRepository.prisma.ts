/**
 * フェーズ5-1-3b: `DonationTaxCreditRecordRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientDonationTaxCreditRecordRepository`。
 * `donationTaxCreditRecordRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで`@/lib/repositories/defaultDonationTaxCreditRecordRepository`を
 * `defaultDonationTaxCreditRecordRepository.standalone.ts`に差し替えた際、このファイル
 * (と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { DonationTaxCreditRecordRepository } from "./donationTaxCreditRecordRepository";
import type { DonationTaxCreditRecord } from "@prisma/client";

export function createPrismaDonationTaxCreditRecordRepository(): DonationTaxCreditRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<DonationTaxCreditRecord | null> {
      return prisma.donationTaxCreditRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, totalTaxCreditJpy, residentTaxBasicDeductionJpy }): Promise<void> {
      await prisma.donationTaxCreditRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, totalTaxCreditJpy, residentTaxBasicDeductionJpy },
        update: { totalTaxCreditJpy, residentTaxBasicDeductionJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.donationTaxCreditRecord.deleteMany({ where: { taxYearId } });
    },
  };
}
