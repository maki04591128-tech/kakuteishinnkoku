/**
 * フェーズ5-1-3d-15: `AngelTaxLossCarryforwardRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientAngelTaxLossCarryforwardRepository`。
 * `angelTaxLossCarryforwardRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで
 * `@/lib/repositories/defaultAngelTaxLossCarryforwardRepository`を
 * `defaultAngelTaxLossCarryforwardRepository.standalone.ts`に差し替えた際、この
 * ファイル(と`@prisma/client`本体)がバンドルに引き込まれない
 * (`casualtyLossCarryforwardRepository.prisma.ts`と同種のパターン)。
 */
import { prisma } from "../db";
import type { AngelTaxLossCarryforward } from "@prisma/client";
import type { AngelTaxLossCarryforwardRepository } from "./angelTaxLossCarryforwardRepository";

export function createPrismaAngelTaxLossCarryforwardRepository(): AngelTaxLossCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<AngelTaxLossCarryforward[]> {
      return prisma.angelTaxLossCarryforward.findMany({
        where: { taxYearId },
        orderBy: { originYear: "asc" },
      });
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      await prisma.angelTaxLossCarryforward.upsert({
        where: {
          taxYearId_originYear: { taxYearId, originYear },
        },
        create: { taxYearId, originYear, remainingAmountJpy },
        update: { remainingAmountJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.angelTaxLossCarryforward.delete({ where: { id } });
    },
  };
}
