/**
 * フェーズ5-1-3b: `CryptoTradeRepository`のPrisma実装(自宅サーバー版が使う)。
 * `../db`経由で`@prisma/client`(Node専用)に依存するため、クライアント実装
 * (`createClientCryptoTradeRepository`。`cryptoTradeRepository.ts`)とは別ファイルに
 * する。これにより、スタンドアロン版ビルドで
 * `@/lib/repositories/defaultCryptoTradeRepository`を
 * `defaultCryptoTradeRepository.standalone.ts`に差し替えた際、このファイル
 * (と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { Prisma, CryptoTrade } from "@prisma/client";
import type { CryptoTradeRepository } from "./cryptoTradeRepository";

export function createPrismaCryptoTradeRepository(): CryptoTradeRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<CryptoTrade[]> {
      return prisma.cryptoTrade.findMany({ where: { taxYearId } });
    },

    async create(data: Prisma.CryptoTradeUncheckedCreateInput): Promise<CryptoTrade> {
      return prisma.cryptoTrade.create({ data });
    },

    async delete(id: number): Promise<void> {
      await prisma.cryptoTrade.delete({ where: { id } });
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
          await tx.cryptoTrade.createMany({
            data: rows.map((row) => ({
              taxYearId,
              tradedAt: row.tradedAt,
              symbol: row.symbol,
              type: row.type as never,
              quantity: row.quantity,
              unitPriceJpy: row.unitPriceJpy,
              feeJpy: row.feeJpy,
              exchange: row.exchange,
              memo: row.memo,
              source: row.source,
              importBatchId: batch.id,
            })),
          });
        }
      });
    },
  };
}
