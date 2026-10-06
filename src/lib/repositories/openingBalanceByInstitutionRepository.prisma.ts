/**
 * フェーズ5-1-3b: `OpeningBalanceByInstitutionRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientOpeningBalanceByInstitutionRepository`。
 * `openingBalanceByInstitutionRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultOpeningBalanceByInstitutionRepository`を
 * `defaultOpeningBalanceByInstitutionRepository.standalone.ts`に差し替えた際、
 * このファイル(と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { OpeningBalanceByInstitutionRepository } from "./openingBalanceByInstitutionRepository";
import type { OpeningBalanceByInstitution } from "@prisma/client";

export function createPrismaOpeningBalanceByInstitutionRepository(): OpeningBalanceByInstitutionRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<OpeningBalanceByInstitution[]> {
      return prisma.openingBalanceByInstitution.findMany({
        where: { taxYearId },
      });
    },

    async upsert({
      taxYearId,
      assetClass,
      symbol,
      institution,
      quantity,
    }): Promise<void> {
      await prisma.openingBalanceByInstitution.upsert({
        where: {
          taxYearId_assetClass_symbol_institution: {
            taxYearId,
            assetClass,
            symbol,
            institution,
          },
        },
        create: { taxYearId, assetClass, symbol, institution, quantity },
        update: { quantity },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.openingBalanceByInstitution.delete({ where: { id } });
    },
  };
}
