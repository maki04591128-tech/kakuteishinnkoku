/**
 * フェーズ1(リポジトリパターン導入): `src/lib/residentTaxAdjustmentDeduction.ts`が
 * 直接`prisma.residentTaxAdjustmentDeductionRecord`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-22でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientResidentTaxAdjustmentDeductionRecordRepository`。wa-sqlite)を追加した。
 * フェーズ5-1-3bで`createPrismaResidentTaxAdjustmentDeductionRecordRepository`
 * (`@prisma/client`(Node専用)に依存)を
 * `residentTaxAdjustmentDeductionRecordRepository.prisma.ts`に分離し、スタンドアロン版
 * バンドルに引き込まれないようにした。`adjustmentDeductionJpy`の型(`Decimal`)は
 * `@prisma/client`の値のみ`import type`で参照し、実体は`decimal.js`(`decimalCodec.ts`)で
 * 生成する(`@prisma/client`の`Prisma.Decimal`は構造的に同一の別クラスだが、値としての
 * importはスタンドアロン版バンドルに`@prisma/client`本体を引き込んでしまうため使わない)。
 */
import type { ResidentTaxAdjustmentDeductionRecord } from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface ResidentTaxAdjustmentDeductionRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<ResidentTaxAdjustmentDeductionRecord | null>;
  upsert(params: { taxYearId: number; adjustmentDeductionJpy: string }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

function rowToResidentTaxAdjustmentDeductionRecord(
  row: Record<string, SqlValue>,
): ResidentTaxAdjustmentDeductionRecord {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    adjustmentDeductionJpy: decodeDecimal(String(row.adjustment_deduction_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-22)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientResidentTaxAdjustmentDeductionRecordRepository(
  db: ClientDb,
): ResidentTaxAdjustmentDeductionRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<ResidentTaxAdjustmentDeductionRecord | null> {
      const rows = await db.all(
        `SELECT id, tax_year_id, adjustment_deduction_jpy, created_at, updated_at
         FROM resident_tax_adjustment_deduction_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
      const row = rows[0];
      return row ? rowToResidentTaxAdjustmentDeductionRecord(row) : null;
    },

    async upsert({ taxYearId, adjustmentDeductionJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encoded = encodeDecimal(new Decimal(adjustmentDeductionJpy));
      await db.run(
        `INSERT INTO resident_tax_adjustment_deduction_record
           (tax_year_id, adjustment_deduction_jpy, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(tax_year_id) DO UPDATE SET
           adjustment_deduction_jpy = excluded.adjustment_deduction_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, encoded, now, now],
      );
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await db.run(
        `DELETE FROM resident_tax_adjustment_deduction_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
    },
  };
}
