/**
 * フェーズ1(リポジトリパターン導入): `src/lib/openingBalance.ts`・
 * `src/app/actions.ts`が直接`prisma.openingBalance`を呼んでいた処理を
 * このインターフェース経由に置き換える。挙動は既存のPrisma実装と完全に
 * 一致させる。(`src/app/import/page.tsx`側の`prisma.openingBalance`
 * 呼び出しは移行時に別途このリポジトリへ委譲する)
 * フェーズ2-27でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientOpeningBalanceRepository`。wa-sqlite)を追加した。
 * 自宅サーバー版は`createPrismaOpeningBalanceRepository`
 * (フェーズ5-1-3bで`openingBalanceRepository.prisma.ts`に分離。
 * `@prisma/client`(Node専用)に依存するため、このファイルからは分離しスタンドアロン版
 * バンドルに引き込まれないようにする)を使う。ビルドターゲットに応じたどちらを使うかの
 * 既定の切り替えは`defaultOpeningBalanceRepository.ts`/
 * `defaultOpeningBalanceRepository.standalone.ts`が担う。
 *
 * `quantity`/`costBasisJpy`の型(`OpeningBalance`の`Decimal`)は
 * `@prisma/client`の値のみ`import type`で参照し、実体は`decimal.js`(`decimalCodec.ts`)で
 * 生成する(`@prisma/client`の`Prisma.Decimal`は構造的に同一の別クラスだが、値としての
 * importはスタンドアロン版バンドルに`@prisma/client`本体を引き込んでしまうため
 * 使わない。`decimal.js`の`Decimal`は型として互換なので代入可能)。
 */
import type { OpeningBalance, OpeningBalanceAssetClass } from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeBoolean, encodeBoolean } from "../clientDb/booleanCodec";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface OpeningBalanceRepository {
  findByTaxYearId(taxYearId: number): Promise<OpeningBalance[]>;
  upsert(params: {
    taxYearId: number;
    assetClass: OpeningBalanceAssetClass;
    symbol: string;
    isNisa: boolean;
    isListed: boolean;
    quantity: string;
    costBasisJpy: string;
  }): Promise<void>;
  delete(id: number): Promise<void>;
  createMany(
    data: Array<{
      taxYearId: number;
      assetClass: OpeningBalanceAssetClass;
      symbol: string;
      isNisa: boolean;
      isListed: boolean;
      quantity: string;
      costBasisJpy: string;
    }>,
  ): Promise<void>;
}

function rowToOpeningBalance(row: Record<string, SqlValue>): OpeningBalance {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    assetClass: String(row.asset_class) as OpeningBalanceAssetClass,
    symbol: String(row.symbol),
    isNisa: decodeBoolean(Number(row.is_nisa)),
    isListed: decodeBoolean(Number(row.is_listed)),
    quantity: decodeDecimal(String(row.quantity)),
    costBasisJpy: decodeDecimal(String(row.cost_basis_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-27)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientOpeningBalanceRepository(
  db: ClientDb,
): OpeningBalanceRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<OpeningBalance[]> {
      const rows = await db.all(
        `SELECT id, tax_year_id, asset_class, symbol, is_nisa, is_listed,
                quantity, cost_basis_jpy, created_at, updated_at
         FROM opening_balance WHERE tax_year_id = ? ORDER BY asset_class, symbol`,
        [taxYearId],
      );
      return rows.map(rowToOpeningBalance);
    },

    async upsert({
      taxYearId,
      assetClass,
      symbol,
      isNisa,
      isListed,
      quantity,
      costBasisJpy,
    }): Promise<void> {
      const now = new Date().toISOString();
      const encodedQuantity = encodeDecimal(new Decimal(quantity));
      const encodedCostBasis = encodeDecimal(new Decimal(costBasisJpy));
      await db.run(
        `INSERT INTO opening_balance
           (tax_year_id, asset_class, symbol, is_nisa, is_listed,
            quantity, cost_basis_jpy, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tax_year_id, asset_class, symbol, is_nisa, is_listed) DO UPDATE SET
           quantity = excluded.quantity,
           cost_basis_jpy = excluded.cost_basis_jpy,
           updated_at = excluded.updated_at`,
        [
          taxYearId,
          assetClass,
          symbol,
          encodeBoolean(isNisa),
          encodeBoolean(isListed),
          encodedQuantity,
          encodedCostBasis,
          now,
          now,
        ],
      );
    },

    async delete(id: number): Promise<void> {
      await db.run(`DELETE FROM opening_balance WHERE id = ?`, [id]);
    },

    async createMany(data): Promise<void> {
      const now = new Date().toISOString();
      for (const {
        taxYearId,
        assetClass,
        symbol,
        isNisa,
        isListed,
        quantity,
        costBasisJpy,
      } of data) {
        await db.run(
          `INSERT INTO opening_balance
             (tax_year_id, asset_class, symbol, is_nisa, is_listed,
              quantity, cost_basis_jpy, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            taxYearId,
            assetClass,
            symbol,
            encodeBoolean(isNisa),
            encodeBoolean(isListed),
            encodeDecimal(new Decimal(quantity)),
            encodeDecimal(new Decimal(costBasisJpy)),
            now,
            now,
          ],
        );
      }
    },
  };
}
