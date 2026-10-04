/**
 * フェーズ5-1-3b: `NisaLifetimeQuotaRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientNisaLifetimeQuotaRepository`。
 * `nisaLifetimeQuotaRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultNisaLifetimeQuotaRepository`を
 * `defaultNisaLifetimeQuotaRepository.standalone.ts`に差し替えた際、
 * このファイル(と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { NisaLifetimeQuotaRepository } from "./nisaLifetimeQuotaRepository";

export function createPrismaNisaLifetimeQuotaRepository(): NisaLifetimeQuotaRepository {
  return {
    async findByTaxYearId(taxYearId: number) {
      return prisma.nisaLifetimeQuota.findMany({ where: { taxYearId } });
    },

    async upsert({
      taxYearId,
      nisaType,
      openingUsedJpy,
      soldCostBasisJpy,
    }): Promise<void> {
      await prisma.nisaLifetimeQuota.upsert({
        where: {
          taxYearId_nisaType: { taxYearId, nisaType },
        },
        create: { taxYearId, nisaType, openingUsedJpy, soldCostBasisJpy },
        update: { openingUsedJpy, soldCostBasisJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.nisaLifetimeQuota.delete({ where: { id } });
    },

    async createMany(data): Promise<void> {
      if (data.length === 0) return;
      await prisma.nisaLifetimeQuota.createMany({ data });
    },
  };
}
