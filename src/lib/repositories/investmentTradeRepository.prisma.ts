/**
 * フェーズ5-1-3b: `InvestmentTradeRepository`のPrisma実装(自宅サーバー版が使う)。
 * `../db`経由で`@prisma/client`(Node専用)に依存するため、クライアント実装
 * (`createClientInvestmentTradeRepository`。`investmentTradeRepository.ts`)とは
 * 別ファイルにする。これにより、スタンドアロン版ビルドで
 * `@/lib/repositories/defaultInvestmentTradeRepository`を
 * `defaultInvestmentTradeRepository.standalone.ts`に差し替えた際、このファイル
 * (と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { Prisma, InvestmentTrade } from "@prisma/client";
import type { InvestmentTradeRepository } from "./investmentTradeRepository";

export function createPrismaInvestmentTradeRepository(): InvestmentTradeRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<InvestmentTrade[]> {
      return prisma.investmentTrade.findMany({ where: { taxYearId } });
    },

    async create(
      data: Prisma.InvestmentTradeUncheckedCreateInput,
    ): Promise<InvestmentTrade> {
      return prisma.investmentTrade.create({ data });
    },

    async delete(id: number): Promise<void> {
      await prisma.investmentTrade.delete({ where: { id } });
    },
  };
}
