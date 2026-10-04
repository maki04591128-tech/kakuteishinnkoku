/**
 * フェーズ1(リポジトリパターン導入): `src/lib/investment/distributionAdjustedForeignTaxCredit.ts`が
 * 直接`prisma.distributionAdjustedForeignTaxCreditRecord`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-23でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientDistributionAdjustedForeignTaxCreditRecordRepository`。wa-sqlite)を追加した。
 * 自宅サーバー版は`createPrismaDistributionAdjustedForeignTaxCreditRecordRepository`
 * (フェーズ5-1-3bで`distributionAdjustedForeignTaxCreditRecordRepository.prisma.ts`に分離。
 * `@prisma/client`(Node専用)に依存するため、このファイルからは分離しスタンドアロン版
 * バンドルに引き込まれないようにする)を使う。ビルドターゲットに応じたどちらを使うかの
 * 既定の切り替えは`defaultDistributionAdjustedForeignTaxCreditRecordRepository.ts`/
 * `defaultDistributionAdjustedForeignTaxCreditRecordRepository.standalone.ts`が担う。
 *
 * `creditJpy`の型(`Decimal`)は`@prisma/client`の値のみ`import type`で参照し、
 * 実体は`decimal.js`(`decimalCodec.ts`)で生成する(`@prisma/client`の`Prisma.Decimal`は
 * 構造的に同一の別クラスだが、値としてのimportはスタンドアロン版バンドルに
 * `@prisma/client`本体を引き込んでしまうため使わない。`decimal.js`の`Decimal`は型として
 * 互換なので代入可能)。
 */
import type { DistributionAdjustedForeignTaxCreditRecord } from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface DistributionAdjustedForeignTaxCreditRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<DistributionAdjustedForeignTaxCreditRecord | null>;
  upsert(params: { taxYearId: number; creditJpy: string }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

function rowToDistributionAdjustedForeignTaxCreditRecord(
  row: Record<string, SqlValue>,
): DistributionAdjustedForeignTaxCreditRecord {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    creditJpy: decodeDecimal(String(row.credit_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-23)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientDistributionAdjustedForeignTaxCreditRecordRepository(
  db: ClientDb,
): DistributionAdjustedForeignTaxCreditRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<DistributionAdjustedForeignTaxCreditRecord | null> {
      const rows = await db.all(
        `SELECT id, tax_year_id, credit_jpy, created_at, updated_at
         FROM distribution_adjusted_foreign_tax_credit_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
      const row = rows[0];
      return row ? rowToDistributionAdjustedForeignTaxCreditRecord(row) : null;
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encoded = encodeDecimal(new Decimal(creditJpy));
      await db.run(
        `INSERT INTO distribution_adjusted_foreign_tax_credit_record
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
        `DELETE FROM distribution_adjusted_foreign_tax_credit_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
    },
  };
}
