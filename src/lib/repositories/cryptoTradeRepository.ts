/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`・`src/app/actions.ts`・
 * `src/app/import/page.tsx`が直接`prisma.cryptoTrade`を呼んでいた処理を
 * このインターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`findByTaxYearId`はorderByを持たないため、表示順が必要な呼び出し元
 * (`src/app/import/page.tsx`)は取得後に呼び出し側でソートする)
 * フェーズ2-34でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientCryptoTradeRepository`。wa-sqlite)を追加した。
 * 自宅サーバー版は`createPrismaCryptoTradeRepository`
 * (フェーズ5-1-3bで`cryptoTradeRepository.prisma.ts`に分離。`@prisma/client`
 * (Node専用)に依存するため、このファイルからは分離しスタンドアロン版バンドルに
 * 引き込まれないようにする)を使う。ビルドターゲットに応じたどちらを使うかの既定の
 * 切り替えは`defaultCryptoTradeRepository.ts`/`defaultCryptoTradeRepository.standalone.ts`
 * が担う。
 *
 * `quantity`/`unitPriceJpy`/`marketValueUnitPriceJpy`/`feeJpy`の型(`Decimal`)は
 * `@prisma/client`の値のみ`import type`で参照し、実体は`decimal.js`
 * (`decimalCodec.ts`)で生成する(`@prisma/client`の`Prisma.Decimal`は構造的に
 * 同一の別クラスだが、値としてのimportはスタンドアロン版バンドルに`@prisma/client`
 * 本体を引き込んでしまうため使わない。`decimal.js`の`Decimal`は型として互換なので
 * 代入可能)。
 */
import type { Prisma, CryptoTrade, CryptoTradeType } from "@prisma/client";
import { Decimal } from "decimal.js";
import {
  decodeDecimal,
  decodeNullableDecimal,
  encodeDecimal,
  encodeNullableDecimal,
} from "../clientDb/decimalCodec";
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

function rowToCryptoTrade(row: Record<string, SqlValue>): CryptoTrade {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    tradedAt: new Date(String(row.traded_at)),
    symbol: String(row.symbol),
    type: String(row.type) as CryptoTradeType,
    quantity: decodeDecimal(String(row.quantity)),
    unitPriceJpy: decodeDecimal(String(row.unit_price_jpy)),
    marketValueUnitPriceJpy: decodeNullableDecimal(
      row.market_value_unit_price_jpy === null
        ? null
        : String(row.market_value_unit_price_jpy),
    ),
    feeJpy: decodeDecimal(String(row.fee_jpy)),
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
