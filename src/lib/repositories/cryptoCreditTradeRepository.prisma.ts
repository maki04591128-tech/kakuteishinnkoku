/**
 * フェーズ5-1-3b: `CryptoCreditTradeRepository`のPrisma実装(自宅サーバー版が使う)。
 * `../db`経由で`@prisma/client`(Node専用)に依存するため、クライアント実装
 * (`createClientCryptoCreditTradeRepository`。`cryptoCreditTradeRepository.ts`)とは
 * 別ファイルにする。これにより、スタンドアロン版ビルドで
 * `@/lib/repositories/defaultCryptoCreditTradeRepository`を
 * `defaultCryptoCreditTradeRepository.standalone.ts`に差し替えた際、このファイル
 * (と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { Prisma, CryptoCreditTrade } from "@prisma/client";
import type { CryptoCreditTradeRepository } from "./cryptoCreditTradeRepository";

export function createPrismaCryptoCreditTradeRepository(): CryptoCreditTradeRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<CryptoCreditTrade[]> {
      return prisma.cryptoCreditTrade.findMany({ where: { taxYearId } });
    },

    async create(
      data: Prisma.CryptoCreditTradeUncheckedCreateInput,
    ): Promise<CryptoCreditTrade> {
      return prisma.cryptoCreditTrade.create({ data });
    },

    async delete(id: number): Promise<void> {
      await prisma.cryptoCreditTrade.delete({ where: { id } });
    },
  };
}
