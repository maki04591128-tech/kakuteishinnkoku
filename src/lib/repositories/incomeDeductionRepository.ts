/**
 * フェーズ1(リポジトリパターン導入): `src/lib/incomeDeduction.ts`が直接
 * `prisma.incomeDeduction`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-26でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientIncomeDeductionRepository`。wa-sqlite)を追加した。
 */
import { Prisma, type IncomeDeduction, type IncomeDeductionType } from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "../db";
import { encodeDecimal } from "../clientDb/decimalCodec";
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

export function createPrismaIncomeDeductionRepository(): IncomeDeductionRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<IncomeDeduction[]> {
      return prisma.incomeDeduction.findMany({
        where: { taxYearId },
      });
    },

    async upsert({ taxYearId, type, incomeTaxAmountJpy, residentTaxAmountJpy }): Promise<void> {
      await prisma.incomeDeduction.upsert({
        where: { taxYearId_type: { taxYearId, type } },
        create: { taxYearId, type, incomeTaxAmountJpy, residentTaxAmountJpy },
        update: { incomeTaxAmountJpy, residentTaxAmountJpy },
      });
    },

    async deleteByTaxYearIdAndType(taxYearId: number, type: IncomeDeductionType): Promise<void> {
      await prisma.incomeDeduction.deleteMany({ where: { taxYearId, type } });
    },
  };
}

function rowToIncomeDeduction(row: Record<string, SqlValue>): IncomeDeduction {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    type: String(row.type) as IncomeDeductionType,
    incomeTaxAmountJpy: new Prisma.Decimal(String(row.income_tax_amount_jpy)),
    residentTaxAmountJpy: new Prisma.Decimal(String(row.resident_tax_amount_jpy)),
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
