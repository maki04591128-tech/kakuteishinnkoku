/**
 * フェーズ1(リポジトリパターン導入): `src/lib/energySavingRenovationDeduction.ts`が直接
 * `prisma.energySavingRenovationDeductionRecord`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-6でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientEnergySavingRenovationDeductionRecordRepository`。wa-sqlite)を追加した。
 * 自宅サーバー版は`createPrismaEnergySavingRenovationDeductionRecordRepository`
 * (フェーズ5-1-3bで`energySavingRenovationDeductionRecordRepository.prisma.ts`に分離。
 * `@prisma/client`(Node専用)に依存するため、このファイルからは分離しスタンドアロン版
 * バンドルに引き込まれないようにする)を使う。ビルドターゲットに応じたどちらを使うかの
 * 既定の切り替えは`defaultEnergySavingRenovationDeductionRecordRepository.ts`/
 * `defaultEnergySavingRenovationDeductionRecordRepository.standalone.ts`が担う。
 *
 * `creditJpy`の型(`EnergySavingRenovationDeductionRecord`の`Decimal`)は
 * `@prisma/client`の値のみ`import type`で参照し、実体は`decimal.js`(`decimalCodec.ts`)で
 * 生成する(`@prisma/client`の`Prisma.Decimal`は構造的に同一の別クラスだが、値としての
 * importはスタンドアロン版バンドルに`@prisma/client`本体を引き込んでしまうため
 * 使わない。`decimal.js`の`Decimal`は型として互換なので代入可能)。
 */
import type { EnergySavingRenovationDeductionRecord } from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface EnergySavingRenovationDeductionRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<EnergySavingRenovationDeductionRecord | null>;
  upsert(params: { taxYearId: number; creditJpy: string }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

function rowToEnergySavingRenovationDeductionRecord(
  row: Record<string, SqlValue>,
): EnergySavingRenovationDeductionRecord {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    creditJpy: decodeDecimal(String(row.credit_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-6)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientEnergySavingRenovationDeductionRecordRepository(
  db: ClientDb,
): EnergySavingRenovationDeductionRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<EnergySavingRenovationDeductionRecord | null> {
      const rows = await db.all(
        `SELECT id, tax_year_id, credit_jpy, created_at, updated_at
         FROM energy_saving_renovation_deduction_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
      const row = rows[0];
      return row ? rowToEnergySavingRenovationDeductionRecord(row) : null;
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encoded = encodeDecimal(new Decimal(creditJpy));
      await db.run(
        `INSERT INTO energy_saving_renovation_deduction_record
           (tax_year_id, credit_jpy, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(tax_year_id) DO UPDATE SET
           credit_jpy = excluded.credit_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, encoded, now, now],
      );
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await db.run(
        `DELETE FROM energy_saving_renovation_deduction_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
    },
  };
}
