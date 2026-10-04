/**
 * フェーズ5-1-3b: `CryptoMarginTradeRepository`のPrisma実装(自宅サーバー版が使う)。
 * `../db`経由で`@prisma/client`(Node専用)に依存するため、クライアント実装
 * (`createClientCryptoMarginTradeRepository`。`cryptoMarginTradeRepository.ts`)とは
 * 別ファイルにする。これにより、スタンドアロン版ビルドで
 * `@/lib/repositories/defaultCryptoMarginTradeRepository`を
 * `defaultCryptoMarginTradeRepository.standalone.ts`に差し替えた際、このファイル
 * (と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { Prisma, CryptoMarginTrade } from "@prisma/client";
import type { CryptoMarginTradeRepository } from "./cryptoMarginTradeRepository";

export function createPrismaCryptoMarginTradeRepository(): CryptoMarginTradeRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<CryptoMarginTrade[]> {
      return prisma.cryptoMarginTrade.findMany({ where: { taxYearId } });
    },

    async create(
      data: Prisma.CryptoMarginTradeUncheckedCreateInput,
    ): Promise<CryptoMarginTrade> {
      return prisma.cryptoMarginTrade.create({ data });
    },

    async delete(id: number): Promise<void> {
      await prisma.cryptoMarginTrade.delete({ where: { id } });
    },

    async importCsvBatch({ taxYearId, sourceType, fileName, rows }): Promise<void> {
      await prisma.$transaction(async (tx) => {
        const batch = await tx.importBatch.create({
          data: {
            taxYearId,
            sourceType,
            fileName,
            rowCount: rows.length,
          },
        });

        if (rows.length > 0) {
          await tx.cryptoMarginTrade.createMany({
            data: rows.map((row) => ({
              taxYearId,
              settledAt: row.settledAt,
              symbol: row.symbol,
              realizedPnlJpy: row.realizedPnlJpy,
              feeJpy: row.feeJpy,
              swapJpy: row.swapJpy,
              exchange: row.exchange,
              source: row.source,
              importBatchId: batch.id,
            })),
          });
        }
      });
    },
  };
}
