/**
 * フェーズ1(リポジトリパターン導入): `src/lib/barrierFreeRenovationDeduction.ts`が直接
 * `prisma.barrierFreeRenovationDeductionRecord`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-4でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientBarrierFreeRenovationDeductionRecordRepository`。wa-sqlite)を追加した。
 * 自宅サーバー版は`createPrismaBarrierFreeRenovationDeductionRecordRepository`
 * (フェーズ5-1-3bで`barrierFreeRenovationDeductionRecordRepository.prisma.ts`に分離。
 * `@prisma/client`(Node専用)に依存するため、このファイルからは分離しスタンドアロン版
 * バンドルに引き込まれないようにする)を使う。ビルドターゲットに応じたどちらを使うかの
 * 既定の切り替えは`defaultBarrierFreeRenovationDeductionRecordRepository.ts`/
 * `defaultBarrierFreeRenovationDeductionRecordRepository.standalone.ts`が担う。
 *
 * `creditJpy`の型(`BarrierFreeRenovationDeductionRecord`の`Decimal`)は`@prisma/client`の
 * 値のみ`import type`で参照し、実体は`decimal.js`(`decimalCodec.ts`)で生成する
 * (`@prisma/client`の`Prisma.Decimal`は構造的に同一の別クラスだが、値としての
 * importはスタンドアロン版バンドルに`@prisma/client`本体を引き込んでしまうため
 * 使わない。`decimal.js`の`Decimal`は型として互換なので代入可能)。
 */
import type { BarrierFreeRenovationDeductionRecord } from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface BarrierFreeRenovationDeductionRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<BarrierFreeRenovationDeductionRecord | null>;
  upsert(params: { taxYearId: number; creditJpy: string }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

function rowToBarrierFreeRenovationDeductionRecord(
  row: Record<string, SqlValue>,
): BarrierFreeRenovationDeductionRecord {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    creditJpy: decodeDecimal(String(row.credit_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-4)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientBarrierFreeRenovationDeductionRecordRepository(
  db: ClientDb,
): BarrierFreeRenovationDeductionRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<BarrierFreeRenovationDeductionRecord | null> {
      const rows = await db.all(
        `SELECT id, tax_year_id, credit_jpy, created_at, updated_at
         FROM barrier_free_renovation_deduction_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
      const row = rows[0];
      return row ? rowToBarrierFreeRenovationDeductionRecord(row) : null;
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encoded = encodeDecimal(new Decimal(creditJpy));
      await db.run(
        `INSERT INTO barrier_free_renovation_deduction_record
           (tax_year_id, credit_jpy, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(tax_year_id) DO UPDATE SET
           credit_jpy = excluded.credit_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, encoded, now, now],
      );
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await db.run(`DELETE FROM barrier_free_renovation_deduction_record WHERE tax_year_id = ?`, [
        taxYearId,
      ]);
    },
  };
}
