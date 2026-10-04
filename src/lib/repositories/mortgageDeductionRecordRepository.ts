/**
 * フェーズ1(リポジトリパターン導入): `src/lib/mortgageDeduction.ts`が直接
 * `prisma.mortgageDeductionRecord`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-21でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientMortgageDeductionRecordRepository`。wa-sqlite)を追加した。
 * 自宅サーバー版は`createPrismaMortgageDeductionRecordRepository`
 * (フェーズ5-1-3bで`mortgageDeductionRecordRepository.prisma.ts`に分離。
 * `@prisma/client`(Node専用)に依存するため、このファイルからは分離しスタンドアロン版
 * バンドルに引き込まれないようにする)を使う。ビルドターゲットに応じたどちらを使うかの
 * 既定の切り替えは`defaultMortgageDeductionRecordRepository.ts`/
 * `defaultMortgageDeductionRecordRepository.standalone.ts`が担う。
 *
 * `nationalTaxCreditJpy`/`residentTaxCreditJpy`の型(`Decimal`)は
 * `@prisma/client`の値のみ`import type`で参照し、実体は`decimal.js`(`decimalCodec.ts`)で
 * 生成する(`@prisma/client`の`Prisma.Decimal`は構造的に同一の別クラスだが、値としての
 * importはスタンドアロン版バンドルに`@prisma/client`本体を引き込んでしまうため
 * 使わない。`decimal.js`の`Decimal`は型として互換なので代入可能)。
 */
import type { MortgageDeductionRecord } from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface MortgageDeductionRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<MortgageDeductionRecord | null>;
  upsert(params: {
    taxYearId: number;
    nationalTaxCreditJpy: string;
    residentTaxCreditJpy: string;
  }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

function rowToMortgageDeductionRecord(row: Record<string, SqlValue>): MortgageDeductionRecord {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    nationalTaxCreditJpy: decodeDecimal(String(row.national_tax_credit_jpy)),
    residentTaxCreditJpy: decodeDecimal(String(row.resident_tax_credit_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-21)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientMortgageDeductionRecordRepository(
  db: ClientDb,
): MortgageDeductionRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<MortgageDeductionRecord | null> {
      const rows = await db.all(
        `SELECT id, tax_year_id, national_tax_credit_jpy, resident_tax_credit_jpy,
                created_at, updated_at
         FROM mortgage_deduction_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
      const row = rows[0];
      return row ? rowToMortgageDeductionRecord(row) : null;
    },

    async upsert({ taxYearId, nationalTaxCreditJpy, residentTaxCreditJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encodedNational = encodeDecimal(new Decimal(nationalTaxCreditJpy));
      const encodedResident = encodeDecimal(new Decimal(residentTaxCreditJpy));
      await db.run(
        `INSERT INTO mortgage_deduction_record
           (tax_year_id, national_tax_credit_jpy, resident_tax_credit_jpy,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(tax_year_id) DO UPDATE SET
           national_tax_credit_jpy = excluded.national_tax_credit_jpy,
           resident_tax_credit_jpy = excluded.resident_tax_credit_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, encodedNational, encodedResident, now, now],
      );
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await db.run(`DELETE FROM mortgage_deduction_record WHERE tax_year_id = ?`, [taxYearId]);
    },
  };
}
