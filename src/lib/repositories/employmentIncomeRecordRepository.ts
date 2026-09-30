/**
 * フェーズ1(リポジトリパターン導入): `src/lib/employmentIncome.ts`が直接
 * `prisma.employmentIncomeRecord`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * フェーズ2-3でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientEmploymentIncomeRecordRepository`。wa-sqlite)を追加した。
 */
import { Prisma, type EmploymentIncomeRecord } from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "../db";
import { encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface EmploymentIncomeRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<EmploymentIncomeRecord | null>;
  upsert(params: { taxYearId: number; grossSalaryJpy: string }): Promise<void>;
  deleteByTaxYearId(taxYearId: number): Promise<void>;
}

export function createPrismaEmploymentIncomeRecordRepository(): EmploymentIncomeRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<EmploymentIncomeRecord | null> {
      return prisma.employmentIncomeRecord.findUnique({ where: { taxYearId } });
    },

    async upsert({ taxYearId, grossSalaryJpy }): Promise<void> {
      await prisma.employmentIncomeRecord.upsert({
        where: { taxYearId },
        create: { taxYearId, grossSalaryJpy },
        update: { grossSalaryJpy },
      });
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await prisma.employmentIncomeRecord.deleteMany({ where: { taxYearId } });
    },
  };
}

function rowToEmploymentIncomeRecord(row: Record<string, SqlValue>): EmploymentIncomeRecord {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    grossSalaryJpy: new Prisma.Decimal(String(row.gross_salary_jpy)),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-3)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientEmploymentIncomeRecordRepository(
  db: ClientDb,
): EmploymentIncomeRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<EmploymentIncomeRecord | null> {
      const rows = await db.all(
        `SELECT id, tax_year_id, gross_salary_jpy, created_at, updated_at
         FROM employment_income_record WHERE tax_year_id = ?`,
        [taxYearId],
      );
      const row = rows[0];
      return row ? rowToEmploymentIncomeRecord(row) : null;
    },

    async upsert({ taxYearId, grossSalaryJpy }): Promise<void> {
      const now = new Date().toISOString();
      const encoded = encodeDecimal(new Decimal(grossSalaryJpy));
      await db.run(
        `INSERT INTO employment_income_record
           (tax_year_id, gross_salary_jpy, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(tax_year_id) DO UPDATE SET
           gross_salary_jpy = excluded.gross_salary_jpy,
           updated_at = excluded.updated_at`,
        [taxYearId, encoded, now, now],
      );
    },

    async deleteByTaxYearId(taxYearId: number): Promise<void> {
      await db.run(`DELETE FROM employment_income_record WHERE tax_year_id = ?`, [taxYearId]);
    },
  };
}
