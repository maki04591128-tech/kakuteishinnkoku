/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`・`src/app/actions.ts`・
 * `src/app/import/page.tsx`が直接`prisma.cryptoTrade`を呼んでいた処理を
 * このインターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`findByTaxYearId`はorderByを持たないため、表示順が必要な呼び出し元
 * (`src/app/import/page.tsx`)は取得後に呼び出し側でソートする)
 */
import type { CryptoTrade, Prisma } from "@prisma/client";
import { prisma } from "../db";

export interface CryptoTradeImportRow {
  tradedAt: Date;
  symbol: string;
  type: string;
  quantity: string;
  unitPriceJpy: string;
  feeJpy: string;
  exchange: string | null;
  memo: string | null;
  source: string;
}

export interface CryptoTradeRepository {
  findByTaxYearId(taxYearId: number): Promise<CryptoTrade[]>;
  create(data: Prisma.CryptoTradeUncheckedCreateInput): Promise<CryptoTrade>;
  delete(id: number): Promise<void>;
  importCsvBatch(input: {
    taxYearId: number;
    sourceType: string;
    fileName: string;
    rows: CryptoTradeImportRow[];
  }): Promise<void>;
}

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
