/**
 * フェーズ1(リポジトリパターン導入): `src/app/foreign-tax-credit/page.tsx`・
 * `src/app/actions.ts`が直接`prisma.foreignTaxCreditSpareLimitCarryforward`を
 * 呼んでいた処理をこのインターフェース経由に置き換える。挙動は既存のPrisma実装と
 * 完全に一致させる。
 * フェーズ2-16でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientForeignTaxCreditSpareLimitCarryforwardRepository`。wa-sqlite)を追加した。
 * 自宅サーバー版は`createPrismaForeignTaxCreditSpareLimitCarryforwardRepository`
 * (フェーズ5-1-3d-16で`foreignTaxCreditSpareLimitCarryforwardRepository.prisma.ts`に
 * 分離。`@prisma/client`(Node専用)に依存するため、このファイルからは分離しスタンドアロン
 * 版バンドルに引き込まれないようにする)を使う。ビルドターゲットに応じたどちらを使うかの
 * 既定の切り替えは`defaultForeignTaxCreditSpareLimitCarryforwardRepository.ts`/
 * `defaultForeignTaxCreditSpareLimitCarryforwardRepository.standalone.ts`が担う。
 *
 * `remainingAmountJpy`の型(`ForeignTaxCreditSpareLimitCarryforward`の`Decimal`)は
 * `@prisma/client`の値のみ`import type`で参照し、実体は`decimal.js`
 * (`decimalCodec.ts`)で生成する(`foreignTaxCreditCarryforwardRepository.ts`と同じ理由)。
 */
import type { ForeignTaxCreditSpareLimitCarryforward } from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface ForeignTaxCreditSpareLimitCarryforwardRepository {
  findByTaxYearId(taxYearId: number): Promise<ForeignTaxCreditSpareLimitCarryforward[]>;
  upsert(params: {
    taxYearId: number;
    originYear: number;
    remainingAmountJpy: string;
  }): Promise<void>;
  delete(id: number): Promise<void>;
  createMany(
    data: Array<{ taxYearId: number; originYear: number; remainingAmountJpy: string }>,
  ): Promise<void>;
}

function rowToForeignTaxCreditSpareLimitCarryforward(
  row: Record<string, SqlValue>,
): ForeignTaxCreditSpareLimitCarryforward {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    originYear: Number(row.origin_year),
    remainingAmountJpy: decodeDecimal(String(row.remaining_amount_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-16)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientForeignTaxCreditSpareLimitCarryforwardRepository(
  db: ClientDb,
): ForeignTaxCreditSpareLimitCarryforwardRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<ForeignTaxCreditSpareLimitCarryforward[]> {
      const rows = await db.all(
        `SELECT id, tax_year_id, origin_year, remaining_amount_jpy, created_at, updated_at
         FROM foreign_tax_credit_spare_limit_carryforward WHERE tax_year_id = ? ORDER BY origin_year`,
        [taxYearId],
      );
      return rows.map(rowToForeignTaxCreditSpareLimitCarryforward);
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encoded = encodeDecimal(new Decimal(remainingAmountJpy));
      await db.run(
        `INSERT INTO foreign_tax_credit_spare_limit_carryforward
           (tax_year_id, origin_year, remaining_amount_jpy, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(tax_year_id, origin_year) DO UPDATE SET
           remaining_amount_jpy = excluded.remaining_amount_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, originYear, encoded, now, now],
      );
    },

    async delete(id: number): Promise<void> {
      await db.run(`DELETE FROM foreign_tax_credit_spare_limit_carryforward WHERE id = ?`, [id]);
    },

    async createMany(data): Promise<void> {
      const now = new Date().toISOString();
      for (const { taxYearId, originYear, remainingAmountJpy } of data) {
        const encoded = encodeDecimal(new Decimal(remainingAmountJpy));
        await db.run(
          `INSERT INTO foreign_tax_credit_spare_limit_carryforward
             (tax_year_id, origin_year, remaining_amount_jpy, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [taxYearId, originYear, encoded, now, now],
        );
      }
    },
  };
}
