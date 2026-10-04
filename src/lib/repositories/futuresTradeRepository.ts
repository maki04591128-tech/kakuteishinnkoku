/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`・`src/app/actions.ts`が
 * 直接`prisma.futuresTrade`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/import/page.tsx`側の`prisma.futuresTrade`呼び出しは
 * 移行時に別途このリポジトリへ委譲する)
 * フェーズ2-38でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientFuturesTradeRepository`。wa-sqlite)を追加した。
 * フェーズ5-1-3bでPrisma実装(`createPrismaFuturesTradeRepository`)を
 * `futuresTradeRepository.prisma.ts`に分離し、ビルドターゲットに応じた
 * 既定実装の切り替えは`defaultFuturesTradeRepository.ts`/
 * `defaultFuturesTradeRepository.standalone.ts`が担う。
 *
 * `realizedPnlJpy`/`feeJpy`/`swapJpy`の型(`Decimal`)は`@prisma/client`の値のみ
 * `import type`で参照し、実体は`decimal.js`(`decimalCodec.ts`)で生成する
 * (`@prisma/client`の値importはスタンドアロン版バンドルに`@prisma/client`本体を
 * 引き込んでしまうため使わない)。
 */
import type { Prisma, FuturesTrade } from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface FuturesTradeImportRow {
  settledAt: Date;
  symbol: string;
  realizedPnlJpy: string;
  feeJpy: string;
  swapJpy: string;
  broker: string | null;
  source: string;
}

export interface FuturesTradeRepository {
  findByTaxYearId(taxYearId: number): Promise<FuturesTrade[]>;
  create(data: Prisma.FuturesTradeUncheckedCreateInput): Promise<FuturesTrade>;
  delete(id: number): Promise<void>;
  importCsvBatch(input: {
    taxYearId: number;
    sourceType: string;
    fileName: string;
    rows: FuturesTradeImportRow[];
  }): Promise<void>;
}

function rowToFuturesTrade(row: Record<string, SqlValue>): FuturesTrade {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    settledAt: new Date(String(row.settled_at)),
    symbol: String(row.symbol),
    realizedPnlJpy: decodeDecimal(String(row.realized_pnl_jpy)),
    feeJpy: decodeDecimal(String(row.fee_jpy)),
    swapJpy: decodeDecimal(String(row.swap_jpy)),
    broker: row.broker === null ? null : String(row.broker),
    memo: row.memo === null ? null : String(row.memo),
    source: String(row.source),
    importBatchId:
      row.import_batch_id === null ? null : Number(row.import_batch_id),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

const SELECT_COLUMNS = `id, tax_year_id, settled_at, symbol, realized_pnl_jpy,
                fee_jpy, swap_jpy, broker, memo, source, import_batch_id,
                created_at, updated_at`;

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-38)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientFuturesTradeRepository(
  db: ClientDb,
): FuturesTradeRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<FuturesTrade[]> {
      const rows = await db.all(
        `SELECT ${SELECT_COLUMNS}
         FROM futures_trade
         WHERE tax_year_id = ?`,
        [taxYearId],
      );
      return rows.map(rowToFuturesTrade);
    },

    async create(
      data: Prisma.FuturesTradeUncheckedCreateInput,
    ): Promise<FuturesTrade> {
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO futures_trade
           (tax_year_id, settled_at, symbol, realized_pnl_jpy, fee_jpy,
            swap_jpy, broker, memo, source, import_batch_id, created_at,
            updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          Number(data.taxYearId),
          new Date(data.settledAt as string | Date).toISOString(),
          String(data.symbol),
          encodeDecimal(new Decimal(String(data.realizedPnlJpy))),
          encodeDecimal(new Decimal(String(data.feeJpy ?? "0"))),
          encodeDecimal(new Decimal(String(data.swapJpy ?? "0"))),
          data.broker === null || data.broker === undefined
            ? null
            : String(data.broker),
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
         FROM futures_trade WHERE id = ?`,
        [Number(rawId)],
      );
      return rowToFuturesTrade(row);
    },

    async delete(id: number): Promise<void> {
      await db.run(`DELETE FROM futures_trade WHERE id = ?`, [id]);
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
          `INSERT INTO futures_trade
             (tax_year_id, settled_at, symbol, realized_pnl_jpy, fee_jpy,
              swap_jpy, broker, source, import_batch_id, created_at,
              updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            taxYearId,
            row.settledAt.toISOString(),
            row.symbol,
            encodeDecimal(new Decimal(row.realizedPnlJpy)),
            encodeDecimal(new Decimal(row.feeJpy)),
            encodeDecimal(new Decimal(row.swapJpy)),
            row.broker,
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
