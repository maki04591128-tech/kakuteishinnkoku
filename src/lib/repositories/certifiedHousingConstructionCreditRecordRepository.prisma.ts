/**
 * フェーズ5-1-3b: `CertifiedHousingConstructionCreditRecordRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientCertifiedHousingConstructionCreditRecordRepository`。
 * `certifiedHousingConstructionCreditRecordRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultCertifiedHousingConstructionCreditRecordRepository`を
 * `defaultCertifiedHousingConstructionCreditRecordRepository.standalone.ts`に差し替えた際、
 * このファイル(と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { CertifiedHousingConstructionCreditRecordRepository } from "./certifiedHousingConstructionCreditRecordRepository";
import type { CertifiedHousingConstructionCreditRecord } from "@prisma/client";

export function createPrismaCertifiedHousingConstructionCreditRecordRepository(): CertifiedHousingConstructionCreditRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<CertifiedHousingConstructionCreditRecord | null> {
      return prisma.certifiedHousingConstructionCreditRecord.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      await prisma.certifiedHousingConstructionCreditRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, creditJpy },
        update: { creditJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.certifiedHousingConstructionCreditRecord.deleteMany({ where: { taxYearId } });
    },
  };
}
