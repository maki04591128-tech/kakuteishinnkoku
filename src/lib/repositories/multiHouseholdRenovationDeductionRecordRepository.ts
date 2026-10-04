/**
 * フェーズ1(リポジトリパターン導入): `src/lib/multiHouseholdRenovationDeduction.ts`が直接
 * `prisma.multiHouseholdRenovationDeductionRecord`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-7でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientMultiHouseholdRenovationDeductionRecordRepository`。wa-sqlite)を追加した。
 * 自宅サーバー版は`createPrismaMultiHouseholdRenovationDeductionRecordRepository`
 * (フェーズ5-1-3bで`multiHouseholdRenovationDeductionRecordRepository.prisma.ts`に分離。
 * `@prisma/client`(Node専用)に依存するため、このファイルからは分離しスタンドアロン版
 * バンドルに引き込まれないようにする)を使う。ビルドターゲットに応じたどちらを使うかの
 * 既定の切り替えは`defaultMultiHouseholdRenovationDeductionRecordRepository.ts`/
 * `defaultMultiHouseholdRenovationDeductionRecordRepository.standalone.ts`が担う。
 *
 * `creditJpy`の型(`MultiHouseholdRenovationDeductionRecord`の`Decimal`)は
 * `@prisma/client`の値のみ`import type`で参照し、実体は`decimal.js`(`decimalCodec.ts`)で
 * 生成する(`@prisma/client`の`Prisma.Decimal`は構造的に同一の別クラスだが、値としての
 * importはスタンドアロン版バンドルに`@prisma/client`本体を引き込んでしまうため
 * 使わない。`decimal.js`の`Decimal`は型として互換なので代入可能)。
 */
import type { MultiHouseholdRenovationDeductionRecord } from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface MultiHouseholdRenovationDeductionRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<MultiHouseholdRenovationDeductionRecord | null>;
  upsert(params: { taxYearId: number; creditJpy: string }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

function rowToMultiHouseholdRenovationDeductionRecord(
  row: Record<string, SqlValue>,
): MultiHouseholdRenovationDeductionRecord {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    creditJpy: decodeDecimal(String(row.credit_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-7)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientMultiHouseholdRenovationDeductionRecordRepository(
  db: ClientDb,
): MultiHouseholdRenovationDeductionRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<MultiHouseholdRenovationDeductionRecord | null> {
      const rows = await db.all(
        `SELECT id, tax_year_id, credit_jpy, created_at, updated_at
         FROM multi_household_renovation_deduction_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
      const row = rows[0];
      return row ? rowToMultiHouseholdRenovationDeductionRecord(row) : null;
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encoded = encodeDecimal(new Decimal(creditJpy));
      await db.run(
        `INSERT INTO multi_household_renovation_deduction_record
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
        `DELETE FROM multi_household_renovation_deduction_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
    },
  };
}
