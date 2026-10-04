/**
 * フェーズ5-1-3b: `StockMarginTradeRepository`のPrisma実装(自宅サーバー版が使う)。
 * `../db`経由で`@prisma/client`(Node専用)に依存するため、クライアント実装
 * (`createClientStockMarginTradeRepository`。`stockMarginTradeRepository.ts`)とは
 * 別ファイルにする。これにより、スタンドアロン版ビルドで
 * `@/lib/repositories/defaultStockMarginTradeRepository`を
 * `defaultStockMarginTradeRepository.standalone.ts`に差し替えた際、このファイル
 * (と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { Prisma, StockMarginTrade } from "@prisma/client";
import type { StockMarginTradeRepository } from "./stockMarginTradeRepository";

export function createPrismaStockMarginTradeRepository(): StockMarginTradeRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<StockMarginTrade[]> {
      return prisma.stockMarginTrade.findMany({ where: { taxYearId } });
    },

    async create(
      data: Prisma.StockMarginTradeUncheckedCreateInput,
    ): Promise<StockMarginTrade> {
      return prisma.stockMarginTrade.create({ data });
    },

    async delete(id: number): Promise<void> {
      await prisma.stockMarginTrade.delete({ where: { id } });
    },
  };
}
