/**
 * フェーズ5-1-3d-17: `HomeSaleLossCarryforwardRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientHomeSaleLossCarryforwardRepository`。
 * `homeSaleLossCarryforwardRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultHomeSaleLossCarryforwardRepository`を
 * `defaultHomeSaleLossCarryforwardRepository.standalone.ts`に差し替えた際、この
 * ファイル(と`@prisma/client`本体)がバンドルに引き込まれない
 * (`casualtyLossCarryforwardRepository.prisma.ts`と同種のパターン)。
 */
import { prisma } from "../db";
import type { HomeSaleLossCarryforwardRepository } from "./homeSaleLossCarryforwardRepository";
import type { HomeSaleLossCarryforward } from "@prisma/client";

export function createPrismaHomeSaleLossCarryforwardRepository(): HomeSaleLossCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<HomeSaleLossCarryforward[]> {
      return prisma.homeSaleLossCarryforward.findMany({
        where: { taxYearId },
        orderBy: { originYear: "asc" },
      });
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      await prisma.homeSaleLossCarryforward.upsert({
        where: {
          taxYearId_originYear: { taxYearId, originYear },
        },
        create: { taxYearId, originYear, remainingAmountJpy },
        update: { remainingAmountJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.homeSaleLossCarryforward.delete({ where: { id } });
    },

    async createMany(data): Promise<void> {
      if (data.length === 0) return;
      await prisma.homeSaleLossCarryforward.createMany({ data });
    },
  };
}
