/**
 * フェーズ5-1-3b: `CertifiedHousingConstructionCreditCarryforwardRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientCertifiedHousingConstructionCreditCarryforwardRepository`。
 * `certifiedHousingConstructionCreditCarryforwardRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultCertifiedHousingConstructionCreditCarryforwardRepository`を
 * `defaultCertifiedHousingConstructionCreditCarryforwardRepository.standalone.ts`に差し替えた際、
 * このファイル(と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { CertifiedHousingConstructionCreditCarryforwardRepository } from "./certifiedHousingConstructionCreditCarryforwardRepository";
import type { CertifiedHousingConstructionCreditCarryforward } from "@prisma/client";

export function createPrismaCertifiedHousingConstructionCreditCarryforwardRepository(): CertifiedHousingConstructionCreditCarryforwardRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<CertifiedHousingConstructionCreditCarryforward | null> {
      return prisma.certifiedHousingConstructionCreditCarryforward.findUnique({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      await prisma.certifiedHousingConstructionCreditCarryforward.upsert({
        where: { taxYearId },
        create: { taxYearId, originYear, remainingAmountJpy },
        update: { originYear, remainingAmountJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.certifiedHousingConstructionCreditCarryforward.deleteMany({
        where: { taxYearId },
      });
    },
  };
}
