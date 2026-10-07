/**
 * フェーズ1(リポジトリパターン導入): `src/app/angel-tax-loss-carryforward/page.tsx`が
 * 直接`prisma.angelTaxLossCarryforward`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-14でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientAngelTaxLossCarryforwardRepository`。wa-sqlite)を追加した。
 * 自宅サーバー版は`createPrismaAngelTaxLossCarryforwardRepository`(フェーズ5-1-3d-15で
 * `angelTaxLossCarryforwardRepository.prisma.ts`に分離。`@prisma/client`(Node専用)に
 * 依存するため、このファイルからは分離しスタンドアロン版バンドルに引き込まれない
 * ようにする)を使う。ビルドターゲットに応じたどちらを使うかの既定の切り替えは
 * `defaultAngelTaxLossCarryforwardRepository.ts`/
 * `defaultAngelTaxLossCarryforwardRepository.standalone.ts`が担う。
 *
 * `remainingAmountJpy`の型(`AngelTaxLossCarryforward`の`Decimal`)は
 * `@prisma/client`の値のみ`import type`で参照し、実体は`decimal.js`
 * (`decimalCodec.ts`)で生成する(`casualtyLossCarryforwardRepository.ts`と
 * 同じ理由。5-1-3d-15でクライアント実装が`new Prisma.Decimal(...)`を使っていた
 * 問題を同様に修正した)。
 */
import type { AngelTaxLossCarryforward } from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface AngelTaxLossCarryforwardRepository {
  findByTaxYearId(taxYearId: number): Promise<AngelTaxLossCarryforward[]>;
  upsert(params: {
    taxYearId: number;
    originYear: number;
    remainingAmountJpy: string;
  }): Promise<void>;
  delete(id: number): Promise<void>;
}

function rowToAngelTaxLossCarryforward(
  row: Record<string, SqlValue>,
): AngelTaxLossCarryforward {
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
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-14)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientAngelTaxLossCarryforwardRepository(
  db: ClientDb,
): AngelTaxLossCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<AngelTaxLossCarryforward[]> {
      const rows = await db.all(
        `SELECT id, tax_year_id, origin_year, remaining_amount_jpy, created_at, updated_at
         FROM angel_tax_loss_carryforward WHERE tax_year_id = ? ORDER BY origin_year`,
        [taxYearId],
      );
      return rows.map(rowToAngelTaxLossCarryforward);
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encoded = encodeDecimal(new Decimal(remainingAmountJpy));
      await db.run(
        `INSERT INTO angel_tax_loss_carryforward
           (tax_year_id, origin_year, remaining_amount_jpy, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(tax_year_id, origin_year) DO UPDATE SET
           remaining_amount_jpy = excluded.remaining_amount_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, originYear, encoded, now, now],
      );
    },

    async delete(id: number): Promise<void> {
      await db.run(`DELETE FROM angel_tax_loss_carryforward WHERE id = ?`, [id]);
    },
  };
}
