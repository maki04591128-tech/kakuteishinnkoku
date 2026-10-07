/**
 * フェーズ5-1-3d-18: `HomeReplacementLossCarryforwardRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientHomeReplacementLossCarryforwardRepository`。
 * `homeReplacementLossCarryforwardRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultHomeReplacementLossCarryforwardRepository`を
 * `defaultHomeReplacementLossCarryforwardRepository.standalone.ts`に差し替えた際、この
 * ファイル(と`@prisma/client`本体)がバンドルに引き込まれない
 * (`homeSaleLossCarryforwardRepository.prisma.ts`と同種のパターン)。
 */
import { prisma } from "../db";
import type { HomeReplacementLossCarryforwardRepository } from "./homeReplacementLossCarryforwardRepository";
import type { HomeReplacementLossCarryforward } from "@prisma/client";

export function createPrismaHomeReplacementLossCarryforwardRepository(): HomeReplacementLossCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<HomeReplacementLossCarryforward[]> {
      return prisma.homeReplacementLossCarryforward.findMany({
        where: { taxYearId },
        orderBy: { originYear: "asc" },
      });
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      await prisma.homeReplacementLossCarryforward.upsert({
        where: {
          taxYearId_originYear: { taxYearId, originYear },
        },
        create: { taxYearId, originYear, remainingAmountJpy },
        update: { remainingAmountJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.homeReplacementLossCarryforward.delete({ where: { id } });
    },

    async createMany(data): Promise<void> {
      if (data.length === 0) return;
      await prisma.homeReplacementLossCarryforward.createMany({ data });
    },
  };
}
