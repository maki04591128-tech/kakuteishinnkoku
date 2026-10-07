/**
 * フェーズ1(リポジトリパターン導入): `src/app/home-replacement-loss-deduction/page.tsx`が
 * 直接`prisma.homeReplacementLossCarryforward`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-19でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientHomeReplacementLossCarryforwardRepository`。wa-sqlite)を追加した。
 * 自宅サーバー版は`createPrismaHomeReplacementLossCarryforwardRepository`
 * (フェーズ5-1-3d-18で`homeReplacementLossCarryforwardRepository.prisma.ts`に分離。
 * `@prisma/client`(Node専用)に依存するため、このファイルからは分離しスタンドアロン版
 * バンドルに引き込まれないようにする)を使う。ビルドターゲットに応じたどちらを使うかの
 * 既定の切り替えは`defaultHomeReplacementLossCarryforwardRepository.ts`/
 * `defaultHomeReplacementLossCarryforwardRepository.standalone.ts`が担う。
 *
 * `remainingAmountJpy`の型(`HomeReplacementLossCarryforward`の`Decimal`)は
 * `@prisma/client`の値のみ`import type`で参照し、実体は`decimal.js`
 * (`decimalCodec.ts`)で生成する(`homeSaleLossCarryforwardRepository.ts`と同じ理由)。
 */
import type { HomeReplacementLossCarryforward } from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface HomeReplacementLossCarryforwardRepository {
  findByTaxYearId(taxYearId: number): Promise<HomeReplacementLossCarryforward[]>;
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

function rowToHomeReplacementLossCarryforward(
  row: Record<string, SqlValue>,
): HomeReplacementLossCarryforward {
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
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-19)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientHomeReplacementLossCarryforwardRepository(
  db: ClientDb,
): HomeReplacementLossCarryforwardRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<HomeReplacementLossCarryforward[]> {
      const rows = await db.all(
        `SELECT id, tax_year_id, origin_year, remaining_amount_jpy, created_at, updated_at
         FROM home_replacement_loss_carryforward WHERE tax_year_id = ? ORDER BY origin_year`,
        [taxYearId],
      );
      return rows.map(rowToHomeReplacementLossCarryforward);
    },

    async upsert({ taxYearId, originYear, remainingAmountJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encoded = encodeDecimal(new Decimal(remainingAmountJpy));
      await db.run(
        `INSERT INTO home_replacement_loss_carryforward
           (tax_year_id, origin_year, remaining_amount_jpy, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(tax_year_id, origin_year) DO UPDATE SET
           remaining_amount_jpy = excluded.remaining_amount_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, originYear, encoded, now, now],
      );
    },

    async delete(id: number): Promise<void> {
      await db.run(`DELETE FROM home_replacement_loss_carryforward WHERE id = ?`, [id]);
    },

    async createMany(data): Promise<void> {
      const now = new Date().toISOString();
      for (const { taxYearId, originYear, remainingAmountJpy } of data) {
        const encoded = encodeDecimal(new Decimal(remainingAmountJpy));
        await db.run(
          `INSERT INTO home_replacement_loss_carryforward
             (tax_year_id, origin_year, remaining_amount_jpy, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [taxYearId, originYear, encoded, now, now],
        );
      }
    },
  };
}
