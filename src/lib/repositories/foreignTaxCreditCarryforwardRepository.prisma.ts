/**
 * フェーズ5-1-3d-16: `ForeignTaxCreditCarryforwardRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientForeignTaxCreditCarryforwardRepository`。
 * `foreignTaxCreditCarryforwardRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultForeignTaxCreditCarryforwardRepository`を
 * `defaultForeignTaxCreditCarryforwardRepository.standalone.ts`に差し替えた際、この
 * ファイル(と`@prisma/client`本体)がバンドルに引き込まれない
 * (`casualtyLossCarryforwardRepository.prisma.ts`と同種のパターン)。
 */
import { prisma } from "../db";
import type { ForeignTaxCreditCarryforwardRepository } from "./foreignTaxCreditCarryforwardRepository";
import type { ForeignTaxCreditCarryforward } from "@prisma/client";

export function createPrismaForeignTaxCreditCarryforwardRepository(): ForeignTaxCreditCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<ForeignTaxCreditCarryforward[]> {
      return prisma.foreignTaxCreditCarryforward.findMany({
        where: { taxYearId },
        orderBy: { originYear: "asc" },
      });
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      await prisma.foreignTaxCreditCarryforward.upsert({
        where: {
          taxYearId_originYear: { taxYearId, originYear },
        },
        create: { taxYearId, originYear, remainingAmountJpy },
        update: { remainingAmountJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.foreignTaxCreditCarryforward.delete({ where: { id } });
    },

    async createMany(data): Promise<void> {
      if (data.length === 0) return;
      await prisma.foreignTaxCreditCarryforward.createMany({ data });
    },
  };
}
