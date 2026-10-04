/**
 * フェーズ5-1-3b: `MortgageDeductionRecordRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientMortgageDeductionRecordRepository`。
 * `mortgageDeductionRecordRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで`@/lib/repositories/defaultMortgageDeductionRecordRepository`を
 * `defaultMortgageDeductionRecordRepository.standalone.ts`に差し替えた際、
 * このファイル(と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { MortgageDeductionRecordRepository } from "./mortgageDeductionRecordRepository";
import type { MortgageDeductionRecord } from "@prisma/client";

export function createPrismaMortgageDeductionRecordRepository(): MortgageDeductionRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<MortgageDeductionRecord | null> {
      return prisma.mortgageDeductionRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, nationalTaxCreditJpy, residentTaxCreditJpy }): Promise<void> {
      await prisma.mortgageDeductionRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, nationalTaxCreditJpy, residentTaxCreditJpy },
        update: { nationalTaxCreditJpy, residentTaxCreditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.mortgageDeductionRecord.deleteMany({ where: { taxYearId } });
    },
  };
}
