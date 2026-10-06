/**
 * フェーズ1(リポジトリパターン導入): `src/app/unrealized-gain/page.tsx`・
 * `src/app/actions.ts`・`src/app/import/page.tsx`が直接`prisma.marketPrice`を
 * 呼んでいた処理をこのインターフェース経由に置き換える。挙動は既存のPrisma実装と
 * 完全に一致させる。
 * フェーズ2-29でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientMarketPriceRepository`。wa-sqlite)を追加した。
 * 自宅サーバー版は`createPrismaMarketPriceRepository`(フェーズ5-1-3bで
 * `marketPriceRepository.prisma.ts`に分離。`@prisma/client`(Node専用)に
 * 依存するため、このファイルからは分離しスタンドアロン版バンドルに引き込まれない
 * ようにする)を使う。ビルドターゲットに応じたどちらを使うかの既定の切り替えは
 * `defaultMarketPriceRepository.ts`/`defaultMarketPriceRepository.standalone.ts`が
 * 担う。
 *
 * `priceJpy`の型(`MarketPrice`の`Decimal`)は`@prisma/client`の値のみ
 * `import type`で参照し、実体は`decimal.js`(`decimalCodec.ts`)で生成する
 * (`@prisma/client`の`Prisma.Decimal`は構造的に同一の別クラスだが、値としての
 * importはスタンドアロン版バンドルに`@prisma/client`本体を引き込んでしまうため
 * 使わない。`decimal.js`の`Decimal`は型として互換なので代入可能)。
 */
import type { MarketPrice } from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface MarketPriceRepository {
  findMany(): Promise<MarketPrice[]>;
  upsert(params: { symbol: string; priceJpy: string }): Promise<void>;
  delete(id: number): Promise<void>;
}

function rowToMarketPrice(row: Record<string, SqlValue>): MarketPrice {
  return {
    id: Number(row.id),
    symbol: String(row.symbol),
    priceJpy: decodeDecimal(String(row.price_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-29)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientMarketPriceRepository(
  db: ClientDb,
): MarketPriceRepository {
  return {
    async findMany(): Promise<MarketPrice[]> {
      const rows = await db.all(
        `SELECT id, symbol, price_jpy, created_at, updated_at
         FROM market_price ORDER BY id`,
      );
      return rows.map(rowToMarketPrice);
    },

    async upsert({ symbol, priceJpy }): Promise<void> {
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO market_price (symbol, price_jpy, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(symbol) DO UPDATE SET
           price_jpy = excluded.price_jpy,
           updated_at = excluded.updated_at`,
        [symbol, encodeDecimal(new Decimal(priceJpy)), now, now],
      );
    },

    async delete(id: number): Promise<void> {
      await db.run(`DELETE FROM market_price WHERE id = ?`, [id]);
    },
  };
}
