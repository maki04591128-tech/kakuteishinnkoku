/**
 * フェーズ1(リポジトリパターン導入): `src/lib/investment/foreignTaxCredit.ts`が直接
 * `prisma.foreignTaxCreditRecord`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-24でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientForeignTaxCreditRecordRepository`。wa-sqlite)を追加した。
 * フェーズ5-1-3bで`createPrismaForeignTaxCreditRecordRepository`
 * (`@prisma/client`(Node専用)に依存)を`foreignTaxCreditRecordRepository.prisma.ts`に
 * 分離し、スタンドアロン版バンドルに引き込まれないようにした。各Decimal列の型は
 * `@prisma/client`の値のみ`import type`で参照し、実体は`decimal.js`
 * (`decimalCodec.ts`)で生成する(`@prisma/client`の`Prisma.Decimal`は構造的に同一の
 * 別クラスだが、値としてのimportはスタンドアロン版バンドルに`@prisma/client`本体を
 * 引き込んでしまうため使わない)。
 */
import type { ForeignTaxCreditRecord } from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface ForeignTaxCreditRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<ForeignTaxCreditRecord | null>;
  upsert(params: {
    taxYearId: number;
    totalCreditJpy: string;
    nationalTaxCreditJpy: string;
    residentTaxCreditJpy: string;
  }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

function rowToForeignTaxCreditRecord(row: Record<string, SqlValue>): ForeignTaxCreditRecord {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    totalCreditJpy: decodeDecimal(String(row.total_tax_credit_jpy)),
    nationalTaxCreditJpy: decodeDecimal(String(row.national_tax_credit_jpy)),
    residentTaxCreditJpy: decodeDecimal(String(row.resident_tax_credit_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-24)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientForeignTaxCreditRecordRepository(
  db: ClientDb,
): ForeignTaxCreditRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<ForeignTaxCreditRecord | null> {
      const rows = await db.all(
        `SELECT id, tax_year_id, total_tax_credit_jpy, national_tax_credit_jpy,
                resident_tax_credit_jpy, created_at, updated_at
         FROM foreign_tax_credit_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
      const row = rows[0];
      return row ? rowToForeignTaxCreditRecord(row) : null;
    },

    async upsert({
      taxYearId,
      totalCreditJpy,
      nationalTaxCreditJpy,
      residentTaxCreditJpy,
    }): Promise<void> {
      const now = new Date().toISOString();
      const encodedTotal = encodeDecimal(new Decimal(totalCreditJpy));
      const encodedNational = encodeDecimal(new Decimal(nationalTaxCreditJpy));
      const encodedResident = encodeDecimal(new Decimal(residentTaxCreditJpy));
      await db.run(
        `INSERT INTO foreign_tax_credit_record
           (tax_year_id, total_tax_credit_jpy, national_tax_credit_jpy,
            resident_tax_credit_jpy, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(tax_year_id) DO UPDATE SET
           total_tax_credit_jpy = excluded.total_tax_credit_jpy,
           national_tax_credit_jpy = excluded.national_tax_credit_jpy,
           resident_tax_credit_jpy = excluded.resident_tax_credit_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, encodedTotal, encodedNational, encodedResident, now, now],
      );
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await db.run(`DELETE FROM foreign_tax_credit_record WHERE tax_year_id = ?`, [taxYearId]);
    },
  };
}
