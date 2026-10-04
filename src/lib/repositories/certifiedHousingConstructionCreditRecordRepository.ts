/**
 * フェーズ1(リポジトリパターン導入): `src/lib/certifiedHousingConstructionCredit.ts`が
 * 直接`prisma.certifiedHousingConstructionCreditRecord`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-10でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientCertifiedHousingConstructionCreditRecordRepository`。wa-sqlite)を追加した。
 * 自宅サーバー版は`createPrismaCertifiedHousingConstructionCreditRecordRepository`
 * (フェーズ5-1-3bで`certifiedHousingConstructionCreditRecordRepository.prisma.ts`に
 * 分離。`@prisma/client`(Node専用)に依存するため、このファイルからは分離しスタンドアロン版
 * バンドルに引き込まれないようにする)を使う。ビルドターゲットに応じたどちらを使うかの
 * 既定の切り替えは`defaultCertifiedHousingConstructionCreditRecordRepository.ts`/
 * `defaultCertifiedHousingConstructionCreditRecordRepository.standalone.ts`が担う。
 *
 * `creditJpy`の型(`CertifiedHousingConstructionCreditRecord`の`Decimal`)は
 * `@prisma/client`の値のみ`import type`で参照し、実体は`decimal.js`(`decimalCodec.ts`)で
 * 生成する(`@prisma/client`の`Prisma.Decimal`は構造的に同一の別クラスだが、値としての
 * importはスタンドアロン版バンドルに`@prisma/client`本体を引き込んでしまうため使わない。
 * `decimal.js`の`Decimal`は型として互換なので代入可能)。
 */
import type { CertifiedHousingConstructionCreditRecord } from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface CertifiedHousingConstructionCreditRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<CertifiedHousingConstructionCreditRecord | null>;
  upsert(params: { taxYearId: number; creditJpy: string }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

function rowToCertifiedHousingConstructionCreditRecord(
  row: Record<string, SqlValue>,
): CertifiedHousingConstructionCreditRecord {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    creditJpy: decodeDecimal(String(row.credit_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-10)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientCertifiedHousingConstructionCreditRecordRepository(
  db: ClientDb,
): CertifiedHousingConstructionCreditRecordRepository {
  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<CertifiedHousingConstructionCreditRecord | null> {
      const rows = await db.all(
        `SELECT id, tax_year_id, credit_jpy, created_at, updated_at
         FROM certified_housing_construction_credit_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
      const row = rows[0];
      return row ? rowToCertifiedHousingConstructionCreditRecord(row) : null;
    },

    async upsert({ taxYearId, creditJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encoded = encodeDecimal(new Decimal(creditJpy));
      await db.run(
        `INSERT INTO certified_housing_construction_credit_record
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
        `DELETE FROM certified_housing_construction_credit_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
    },
  };
}
