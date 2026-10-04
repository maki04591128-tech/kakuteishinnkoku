/**
 * フェーズ5-1-3b: `FuturesLossCarryforwardRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientFuturesLossCarryforwardRepository`。
 * `futuresLossCarryforwardRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultFuturesLossCarryforwardRepository`を
 * `defaultFuturesLossCarryforwardRepository.standalone.ts`に差し替えた際、
 * このファイル(と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { FuturesLossCarryforwardRepository } from "./futuresLossCarryforwardRepository";

export function createPrismaFuturesLossCarryforwardRepository(): FuturesLossCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number) {
      return prisma.futuresLossCarryforward.findMany({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      await prisma.futuresLossCarryforward.upsert({
        where: {
          taxYearId_originYear: { taxYearId, originYear },
        },
        create: { taxYearId, originYear, remainingAmountJpy },
        update: { remainingAmountJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.futuresLossCarryforward.delete({ where: { id } });
    },

    async createMany(data): Promise<void> {
      if (data.length === 0) return;
      await prisma.futuresLossCarryforward.createMany({ data });
    },
  };
}
