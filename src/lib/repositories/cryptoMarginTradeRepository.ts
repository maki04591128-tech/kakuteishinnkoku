/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`・`src/app/actions.ts`・
 * `src/app/import/page.tsx`が直接`prisma.cryptoMarginTrade`を呼んでいた処理を
 * このインターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`findByTaxYearId`はorderByを持たないため、表示順が必要な呼び出し元
 * (`src/app/import/page.tsx`)は取得後に呼び出し側でソートする)
 * フェーズ2-35でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientCryptoMarginTradeRepository`。wa-sqlite)を追加した。
 * 自宅サーバー版は`createPrismaCryptoMarginTradeRepository`
 * (フェーズ5-1-3bで`cryptoMarginTradeRepository.prisma.ts`に分離。`@prisma/client`
 * (Node専用)に依存するため、このファイルからは分離しスタンドアロン版バンドルに
 * 引き込まれないようにする)を使う。ビルドターゲットに応じたどちらを使うかの既定の
 * 切り替えは
 * `defaultCryptoMarginTradeRepository.ts`/`defaultCryptoMarginTradeRepository.standalone.ts`
 * が担う。
 *
 * `realizedPnlJpy`/`feeJpy`/`swapJpy`の型(`Decimal`)は`@prisma/client`の値のみ
 * `import type`で参照し、実体は`decimal.js`(`decimalCodec.ts`)で生成する
 * (`@prisma/client`の`Prisma.Decimal`は構造的に同一の別クラスだが、値としての
 * importはスタンドアロン版バンドルに`@prisma/client`本体を引き込んでしまうため
 * 使わない。`decimal.js`の`Decimal`は型として互換なので代入可能)。
 */
import type { Prisma, CryptoMarginTrade } from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

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

function rowToCryptoMarginTrade(
  row: Record<string, SqlValue>,
): CryptoMarginTrade {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    settledAt: new Date(String(row.settled_at)),
    symbol: String(row.symbol),
    realizedPnlJpy: decodeDecimal(String(row.realized_pnl_jpy)),
    feeJpy: decodeDecimal(String(row.fee_jpy)),
    swapJpy: decodeDecimal(String(row.swap_jpy)),
    exchange: row.exchange === null ? null : String(row.exchange),
    memo: row.memo === null ? null : String(row.memo),
    source: String(row.source),
    importBatchId:
      row.import_batch_id === null ? null : Number(row.import_batch_id),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

const SELECT_COLUMNS = `id, tax_year_id, settled_at, symbol, realized_pnl_jpy,
                fee_jpy, swap_jpy, exchange, memo, source, import_batch_id,
                created_at, updated_at`;

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-35)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientCryptoMarginTradeRepository(
  db: ClientDb,
): CryptoMarginTradeRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<CryptoMarginTrade[]> {
      const rows = await db.all(
        `SELECT ${SELECT_COLUMNS}
         FROM crypto_margin_trade
         WHERE tax_year_id = ?`,
        [taxYearId],
      );
      return rows.map(rowToCryptoMarginTrade);
    },

    async create(
      data: Prisma.CryptoMarginTradeUncheckedCreateInput,
    ): Promise<CryptoMarginTrade> {
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO crypto_margin_trade
           (tax_year_id, settled_at, symbol, realized_pnl_jpy, fee_jpy,
            swap_jpy, exchange, memo, source, import_batch_id, created_at,
            updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          Number(data.taxYearId),
          new Date(data.settledAt as string | Date).toISOString(),
          String(data.symbol),
          encodeDecimal(new Decimal(String(data.realizedPnlJpy))),
          encodeDecimal(new Decimal(String(data.feeJpy ?? "0"))),
          encodeDecimal(new Decimal(String(data.swapJpy ?? "0"))),
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
        `SELECT ${SELECT_COLUMNS}
         FROM crypto_margin_trade WHERE id = ?`,
        [Number(rawId)],
      );
      return rowToCryptoMarginTrade(row);
    },

    async delete(id: number): Promise<void> {
      await db.run(`DELETE FROM crypto_margin_trade WHERE id = ?`, [id]);
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
          `INSERT INTO crypto_margin_trade
             (tax_year_id, settled_at, symbol, realized_pnl_jpy, fee_jpy,
              swap_jpy, exchange, source, import_batch_id, created_at,
              updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            taxYearId,
            row.settledAt.toISOString(),
            row.symbol,
            encodeDecimal(new Decimal(row.realizedPnlJpy)),
            encodeDecimal(new Decimal(row.feeJpy)),
            encodeDecimal(new Decimal(row.swapJpy)),
            row.exchange,
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
