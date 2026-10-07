/**
 * フェーズ5-1-3d-16: `ForeignTaxCreditSpareLimitCarryforwardRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientForeignTaxCreditSpareLimitCarryforwardRepository`。
 * `foreignTaxCreditSpareLimitCarryforwardRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultForeignTaxCreditSpareLimitCarryforwardRepository`を
 * `defaultForeignTaxCreditSpareLimitCarryforwardRepository.standalone.ts`に差し替えた際、
 * このファイル(と`@prisma/client`本体)がバンドルに引き込まれない
 * (`foreignTaxCreditCarryforwardRepository.prisma.ts`と同種のパターン)。
 */
import { prisma } from "../db";
import type { ForeignTaxCreditSpareLimitCarryforwardRepository } from "./foreignTaxCreditSpareLimitCarryforwardRepository";
import type { ForeignTaxCreditSpareLimitCarryforward } from "@prisma/client";

export function createPrismaForeignTaxCreditSpareLimitCarryforwardRepository(): ForeignTaxCreditSpareLimitCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<ForeignTaxCreditSpareLimitCarryforward[]> {
      return prisma.foreignTaxCreditSpareLimitCarryforward.findMany({
        where: { taxYearId },
        orderBy: { originYear: "asc" },
      });
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      await prisma.foreignTaxCreditSpareLimitCarryforward.upsert({
        where: {
          taxYearId_originYear: { taxYearId, originYear },
        },
        create: { taxYearId, originYear, remainingAmountJpy },
        update: { remainingAmountJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.foreignTaxCreditSpareLimitCarryforward.delete({ where: { id } });
    },

    async createMany(data): Promise<void> {
      if (data.length === 0) return;
      await prisma.foreignTaxCreditSpareLimitCarryforward.createMany({ data });
    },
  };
}
