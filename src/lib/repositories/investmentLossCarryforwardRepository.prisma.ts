/**
 * フェーズ5-1-3b: `InvestmentLossCarryforwardRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientInvestmentLossCarryforwardRepository`。
 * `investmentLossCarryforwardRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultInvestmentLossCarryforwardRepository`を
 * `defaultInvestmentLossCarryforwardRepository.standalone.ts`に差し替えた際、
 * このファイル(と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { InvestmentLossCarryforwardRepository } from "./investmentLossCarryforwardRepository";

export function createPrismaInvestmentLossCarryforwardRepository(): InvestmentLossCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number) {
      return prisma.investmentLossCarryforward.findMany({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      await prisma.investmentLossCarryforward.upsert({
        where: {
          taxYearId_originYear: { taxYearId, originYear },
        },
        create: { taxYearId, originYear, remainingAmountJpy },
        update: { remainingAmountJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.investmentLossCarryforward.delete({ where: { id } });
    },

    async createMany(data): Promise<void> {
      if (data.length === 0) return;
      await prisma.investmentLossCarryforward.createMany({ data });
    },
  };
}
