/**
 * フェーズ1(リポジトリパターン導入): `src/lib/donationTaxCredit.ts`が
 * 直接`prisma.donationTaxCreditRecord`を呼んでいた処理をこの
 * インターフェース経由に置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-20でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientDonationTaxCreditRecordRepository`。wa-sqlite)を追加した。
 * 自宅サーバー版は`createPrismaDonationTaxCreditRecordRepository`(フェーズ5-1-3bで
 * `donationTaxCreditRecordRepository.prisma.ts`に分離。`@prisma/client`(Node専用)に
 * 依存するため、このファイルからは分離しスタンドアロン版バンドルに引き込まれない
 * ようにする)を使う。ビルドターゲットに応じたどちらを使うかの既定の切り替えは
 * `defaultDonationTaxCreditRecordRepository.ts`/
 * `defaultDonationTaxCreditRecordRepository.standalone.ts`が担う。
 *
 * `totalTaxCreditJpy`/`residentTaxBasicDeductionJpy`の型
 * (`DonationTaxCreditRecord`の`Decimal`)は`@prisma/client`の値のみ`import type`で
 * 参照し、実体は`decimal.js`(`decimalCodec.ts`)で生成する(`@prisma/client`の
 * `Prisma.Decimal`は構造的に同一の別クラスだが、値としてのimportはスタンドアロン版
 * バンドルに`@prisma/client`本体を引き込んでしまうため使わない。`decimal.js`の
 * `Decimal`は型として互換なので代入可能)。
 */
import type { DonationTaxCreditRecord } from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface DonationTaxCreditRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<DonationTaxCreditRecord | null>;
  upsert(params: {
    taxYearId: number;
    totalTaxCreditJpy: string;
    residentTaxBasicDeductionJpy: string;
  }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

function rowToDonationTaxCreditRecord(row: Record<string, SqlValue>): DonationTaxCreditRecord {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    totalTaxCreditJpy: decodeDecimal(String(row.total_tax_credit_jpy)),
    residentTaxBasicDeductionJpy: decodeDecimal(String(row.resident_tax_basic_deduction_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-20)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientDonationTaxCreditRecordRepository(
  db: ClientDb,
): DonationTaxCreditRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<DonationTaxCreditRecord | null> {
      const rows = await db.all(
        `SELECT id, tax_year_id, total_tax_credit_jpy, resident_tax_basic_deduction_jpy,
                created_at, updated_at
         FROM donation_tax_credit_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
      const row = rows[0];
      return row ? rowToDonationTaxCreditRecord(row) : null;
    },

    async upsert({ taxYearId, totalTaxCreditJpy, residentTaxBasicDeductionJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encodedTotal = encodeDecimal(new Decimal(totalTaxCreditJpy));
      const encodedResidentBasic = encodeDecimal(new Decimal(residentTaxBasicDeductionJpy));
      await db.run(
        `INSERT INTO donation_tax_credit_record
           (tax_year_id, total_tax_credit_jpy, resident_tax_basic_deduction_jpy,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(tax_year_id) DO UPDATE SET
           total_tax_credit_jpy = excluded.total_tax_credit_jpy,
           resident_tax_basic_deduction_jpy = excluded.resident_tax_basic_deduction_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, encodedTotal, encodedResidentBasic, now, now],
      );
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await db.run(`DELETE FROM donation_tax_credit_record WHERE tax_year_id = ?`, [taxYearId]);
    },
  };
}
