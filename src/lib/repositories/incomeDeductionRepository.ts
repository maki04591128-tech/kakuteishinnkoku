/**
 * フェーズ1(リポジトリパターン導入): `src/lib/incomeDeduction.ts`が直接
 * `prisma.incomeDeduction`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-26でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientIncomeDeductionRepository`。wa-sqlite)を追加した。
 * Prisma実装(`createPrismaIncomeDeductionRepository`)はフェーズ5-1-3bで
 * `incomeDeductionRepository.prisma.ts`に分離した(`@prisma/client`
 * (Node専用)に依存するため、このファイルからは分離しスタンドアロン版
 * バンドルに引き込まれないようにする)。
 *
 * `incomeTaxAmountJpy`/`residentTaxAmountJpy`の型(`IncomeDeduction`の`Decimal`)は
 * `@prisma/client`の値のみ`import type`で参照し、実体は`decimal.js`(`decimalCodec.ts`)で
 * 生成する(`@prisma/client`の`Prisma.Decimal`は構造的に同一の別クラスだが、値としての
 * importはスタンドアロン版バンドルに`@prisma/client`本体を引き込んでしまうため使わない。
 * `decimal.js`の`Decimal`は型として互換なので代入可能)。
 */
import type { IncomeDeduction, IncomeDeductionType } from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface IncomeDeductionRepository {
  findByTaxYearId(taxYearId: number): Promise<IncomeDeduction[]>;
  upsert(params: {
    taxYearId: number;
    type: IncomeDeductionType;
    incomeTaxAmountJpy: string;
    residentTaxAmountJpy: string;
  }): Promise<void>;
  deleteByTaxYearIdAndType(taxYearId: number, type: IncomeDeductionType): Promise<void>;
}

function rowToIncomeDeduction(row: Record<string, SqlValue>): IncomeDeduction {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    type: String(row.type) as IncomeDeductionType,
    incomeTaxAmountJpy: decodeDecimal(String(row.income_tax_amount_jpy)),
    residentTaxAmountJpy: decodeDecimal(String(row.resident_tax_amount_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-26)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientIncomeDeductionRepository(db: ClientDb): IncomeDeductionRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<IncomeDeduction[]> {
      const rows = await db.all(
        `SELECT id, tax_year_id, type, income_tax_amount_jpy, resident_tax_amount_jpy,
                created_at, updated_at
         FROM income_deduction WHERE tax_year_id = ? ORDER BY type`,
        [taxYearId],
      );
      return rows.map(rowToIncomeDeduction);
    },

    async upsert({ taxYearId, type, incomeTaxAmountJpy, residentTaxAmountJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encodedIncomeTax = encodeDecimal(new Decimal(incomeTaxAmountJpy));
      const encodedResidentTax = encodeDecimal(new Decimal(residentTaxAmountJpy));
      await db.run(
        `INSERT INTO income_deduction
           (tax_year_id, type, income_tax_amount_jpy, resident_tax_amount_jpy,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(tax_year_id, type) DO UPDATE SET
           income_tax_amount_jpy = excluded.income_tax_amount_jpy,
           resident_tax_amount_jpy = excluded.resident_tax_amount_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, type, encodedIncomeTax, encodedResidentTax, now, now],
      );
    },

    async deleteByTaxYearIdAndType(taxYearId: number, type: IncomeDeductionType): Promise<void> {
      await db.run(`DELETE FROM income_deduction WHERE tax_year_id = ? AND type = ?`, [
        taxYearId,
        type,
      ]);
    },
  };
}
