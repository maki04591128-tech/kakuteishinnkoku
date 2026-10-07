/**
 * フェーズ5-1-3d-14: `CasualtyLossCarryforwardRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientCasualtyLossCarryforwardRepository`。
 * `casualtyLossCarryforwardRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultCasualtyLossCarryforwardRepository`を
 * `defaultCasualtyLossCarryforwardRepository.standalone.ts`に差し替えた際、この
 * ファイル(と`@prisma/client`本体)がバンドルに引き込まれない
 * (`marketPriceRepository.prisma.ts`と同種のパターン)。
 */
import { prisma } from "../db";
import type { CasualtyLossCarryforwardRepository } from "./casualtyLossCarryforwardRepository";
import type { CasualtyLossCarryforward } from "@prisma/client";

export function createPrismaCasualtyLossCarryforwardRepository(): CasualtyLossCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<CasualtyLossCarryforward[]> {
      return prisma.casualtyLossCarryforward.findMany({
        where: { taxYearId },
        orderBy: { originYear: "asc" },
      });
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      await prisma.casualtyLossCarryforward.upsert({
        where: {
          taxYearId_originYear: { taxYearId, originYear },
        },
        create: { taxYearId, originYear, remainingAmountJpy },
        update: { remainingAmountJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.casualtyLossCarryforward.delete({ where: { id } });
    },

    async createMany(data): Promise<void> {
      if (data.length === 0) return;
      await prisma.casualtyLossCarryforward.createMany({ data });
    },
  };
}
