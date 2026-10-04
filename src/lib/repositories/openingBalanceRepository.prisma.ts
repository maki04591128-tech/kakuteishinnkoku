/**
 * フェーズ5-1-3b: `OpeningBalanceRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientOpeningBalanceRepository`。
 * `openingBalanceRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで`@/lib/repositories/defaultOpeningBalanceRepository`を
 * `defaultOpeningBalanceRepository.standalone.ts`に差し替えた際、
 * このファイル(と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { OpeningBalanceRepository } from "./openingBalanceRepository";
import type { OpeningBalance } from "@prisma/client";

export function createPrismaOpeningBalanceRepository(): OpeningBalanceRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<OpeningBalance[]> {
      return prisma.openingBalance.findMany({ where: { taxYearId } });
    },

    async upsert({
      taxYearId,
      assetClass,
      symbol,
      isNisa,
      isListed,
      quantity,
      costBasisJpy,
    }): Promise<void> {
      await prisma.openingBalance.upsert({
        where: {
          taxYearId_assetClass_symbol_isNisa_isListed: {
            taxYearId,
            assetClass,
            symbol,
            isNisa,
            isListed,
          },
        },
        create: {
          taxYearId,
          assetClass,
          symbol,
          isNisa,
          isListed,
          quantity,
          costBasisJpy,
        },
        update: { quantity, costBasisJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.openingBalance.delete({ where: { id } });
    },

    async createMany(data): Promise<void> {
      if (data.length === 0) return;
      await prisma.openingBalance.createMany({ data });
    },
  };
}
