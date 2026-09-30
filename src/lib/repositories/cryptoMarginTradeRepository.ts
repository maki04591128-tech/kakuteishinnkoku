/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`・`src/app/actions.ts`・
 * `src/app/import/page.tsx`が直接`prisma.cryptoMarginTrade`を呼んでいた処理を
 * このインターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`findByTaxYearId`はorderByを持たないため、表示順が必要な呼び出し元
 * (`src/app/import/page.tsx`)は取得後に呼び出し側でソートする)
 */
import type { CryptoMarginTrade, Prisma } from "@prisma/client";
import { prisma } from "../db";

export interface CryptoMarginTradeImportRow {
  settledAt: Date;
  symbol: string;
  realizedPnlJpy: string;
  feeJpy: string;
  swapJpy: string;
  exchange: string | null;
  source: string;
}

export interface CryptoMarginTradeRepository {
  findByTaxYearId(taxYearId: number): Promise<CryptoMarginTrade[]>;
  create(
    data: Prisma.CryptoMarginTradeUncheckedCreateInput,
  ): Promise<CryptoMarginTrade>;
  delete(id: number): Promise<void>;
  importCsvBatch(input: {
    taxYearId: number;
    sourceType: string;
    fileName: string;
    rows: CryptoMarginTradeImportRow[];
  }): Promise<void>;
}

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
