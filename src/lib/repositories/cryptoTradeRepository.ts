/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`・`src/app/actions.ts`・
 * `src/app/import/page.tsx`が直接`prisma.cryptoTrade`を呼んでいた処理を
 * このインターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`findByTaxYearId`はorderByを持たないため、表示順が必要な呼び出し元
 * (`src/app/import/page.tsx`)は取得後に呼び出し側でソートする)
 * フェーズ2-34でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientCryptoTradeRepository`。wa-sqlite)を追加した。
 */
import { Prisma, type CryptoTrade, type CryptoTradeType } from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "../db";
import { encodeDecimal, encodeNullableDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

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

function rowToCryptoTrade(row: Record<string, SqlValue>): CryptoTrade {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    tradedAt: new Date(String(row.traded_at)),
    symbol: String(row.symbol),
    type: String(row.type) as CryptoTradeType,
    quantity: new Prisma.Decimal(String(row.quantity)),
    unitPriceJpy: new Prisma.Decimal(String(row.unit_price_jpy)),
    marketValueUnitPriceJpy:
      row.market_value_unit_price_jpy === null
        ? null
        : new Prisma.Decimal(String(row.market_value_unit_price_jpy)),
    feeJpy: new Prisma.Decimal(String(row.fee_jpy)),
    exchange: row.exchange === null ? null : String(row.exchange),
    memo: row.memo === null ? null : String(row.memo),
    source: String(row.source),
    importBatchId:
      row.import_batch_id === null ? null : Number(row.import_batch_id),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-34)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientCryptoTradeRepository(
  db: ClientDb,
): CryptoTradeRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<CryptoTrade[]> {
      const rows = await db.all(
        `SELECT id, tax_year_id, traded_at, symbol, type, quantity,
                unit_price_jpy, market_value_unit_price_jpy, fee_jpy,
                exchange, memo, source, import_batch_id, created_at, updated_at
         FROM crypto_trade
         WHERE tax_year_id = ?`,
        [taxYearId],
      );
      return rows.map(rowToCryptoTrade);
    },

    async create(
      data: Prisma.CryptoTradeUncheckedCreateInput,
    ): Promise<CryptoTrade> {
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO crypto_trade
           (tax_year_id, traded_at, symbol, type, quantity, unit_price_jpy,
            market_value_unit_price_jpy, fee_jpy, exchange, memo, source,
            import_batch_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          Number(data.taxYearId),
          new Date(data.tradedAt as string | Date).toISOString(),
          String(data.symbol),
          String(data.type),
          encodeDecimal(new Decimal(String(data.quantity))),
          encodeDecimal(new Decimal(String(data.unitPriceJpy))),
          encodeNullableDecimal(
            data.marketValueUnitPriceJpy === null ||
              data.marketValueUnitPriceJpy === undefined
              ? null
              : new Decimal(String(data.marketValueUnitPriceJpy)),
          ),
          encodeDecimal(
            new Decimal(String(data.feeJpy ?? "0")),
          ),
          data.exchange === null || data.exchange === undefined
            ? null
            : String(data.exchange),
          data.memo === null || data.memo === undefined
            ? null
            : String(data.memo),
          data.source === undefined ? "manual" : String(data.source),
          data.importBatchId === null || data.importBatchId === undefined
            ? null
            : Number(data.importBatchId),
          now,
          now,
        ],
      );
      const [{ id: rawId }] = await db.all(`SELECT last_insert_rowid() AS id`);
      const [row] = await db.all(
        `SELECT id, tax_year_id, traded_at, symbol, type, quantity,
                unit_price_jpy, market_value_unit_price_jpy, fee_jpy,
                exchange, memo, source, import_batch_id, created_at, updated_at
         FROM crypto_trade WHERE id = ?`,
        [Number(rawId)],
      );
      return rowToCryptoTrade(row);
    },

    async delete(id: number): Promise<void> {
      await db.run(`DELETE FROM crypto_trade WHERE id = ?`, [id]);
    },

    async importCsvBatch({
      taxYearId,
      sourceType,
      fileName,
      rows,
    }): Promise<void> {
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO import_batch (tax_year_id, source_type, file_name, imported_at, row_count)
         VALUES (?, ?, ?, ?, ?)`,
        [taxYearId, sourceType, fileName, now, rows.length],
      );
      const [{ id: rawBatchId }] = await db.all(
        `SELECT last_insert_rowid() AS id`,
      );
      const batchId = Number(rawBatchId);

      for (const row of rows) {
        await db.run(
          `INSERT INTO crypto_trade
             (tax_year_id, traded_at, symbol, type, quantity, unit_price_jpy,
              fee_jpy, exchange, memo, source, import_batch_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            taxYearId,
            row.tradedAt.toISOString(),
            row.symbol,
            row.type,
            encodeDecimal(new Decimal(row.quantity)),
            encodeDecimal(new Decimal(row.unitPriceJpy)),
            encodeDecimal(new Decimal(row.feeJpy)),
            row.exchange,
            row.memo,
            row.source,
            batchId,
            now,
            now,
          ],
        );
      }
    },
  };
}
