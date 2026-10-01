/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`・`src/app/actions.ts`が
 * 直接`prisma.cryptoCreditTrade`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/import/page.tsx`側の`prisma.cryptoCreditTrade`呼び出しは
 * 移行時に別途このリポジトリへ委譲する)
 * フェーズ2-36でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientCryptoCreditTradeRepository`。wa-sqlite)を追加した。
 */
import { Prisma, type CryptoCreditTrade } from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "../db";
import { encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface CryptoCreditTradeRepository {
  findByTaxYearId(taxYearId: number): Promise<CryptoCreditTrade[]>;
  create(
    data: Prisma.CryptoCreditTradeUncheckedCreateInput,
  ): Promise<CryptoCreditTrade>;
  delete(id: number): Promise<void>;
}

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

function rowToCryptoCreditTrade(
  row: Record<string, SqlValue>,
): CryptoCreditTrade {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    settledAt: new Date(String(row.settled_at)),
    symbol: String(row.symbol),
    realizedPnlJpy: new Prisma.Decimal(String(row.realized_pnl_jpy)),
    feeJpy: new Prisma.Decimal(String(row.fee_jpy)),
    interestAdjustmentJpy: new Prisma.Decimal(
      String(row.interest_adjustment_jpy),
    ),
    exchange: row.exchange === null ? null : String(row.exchange),
    memo: row.memo === null ? null : String(row.memo),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

const SELECT_COLUMNS = `id, tax_year_id, settled_at, symbol, realized_pnl_jpy,
                fee_jpy, interest_adjustment_jpy, exchange, memo, created_at,
                updated_at`;

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-36)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientCryptoCreditTradeRepository(
  db: ClientDb,
): CryptoCreditTradeRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<CryptoCreditTrade[]> {
      const rows = await db.all(
        `SELECT ${SELECT_COLUMNS}
         FROM crypto_credit_trade
         WHERE tax_year_id = ?`,
        [taxYearId],
      );
      return rows.map(rowToCryptoCreditTrade);
    },

    async create(
      data: Prisma.CryptoCreditTradeUncheckedCreateInput,
    ): Promise<CryptoCreditTrade> {
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO crypto_credit_trade
           (tax_year_id, settled_at, symbol, realized_pnl_jpy, fee_jpy,
            interest_adjustment_jpy, exchange, memo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          Number(data.taxYearId),
          new Date(data.settledAt as string | Date).toISOString(),
          String(data.symbol),
          encodeDecimal(new Decimal(String(data.realizedPnlJpy))),
          encodeDecimal(new Decimal(String(data.feeJpy ?? "0"))),
          encodeDecimal(
            new Decimal(String(data.interestAdjustmentJpy ?? "0")),
          ),
          data.exchange === null || data.exchange === undefined
            ? null
            : String(data.exchange),
          data.memo === null || data.memo === undefined
            ? null
            : String(data.memo),
          now,
          now,
        ],
      );
      const [{ id: rawId }] = await db.all(`SELECT last_insert_rowid() AS id`);
      const [row] = await db.all(
        `SELECT ${SELECT_COLUMNS}
         FROM crypto_credit_trade WHERE id = ?`,
        [Number(rawId)],
      );
      return rowToCryptoCreditTrade(row);
    },

    async delete(id: number): Promise<void> {
      await db.run(`DELETE FROM crypto_credit_trade WHERE id = ?`, [id]);
    },
  };
}
