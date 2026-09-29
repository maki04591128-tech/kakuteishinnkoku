/**
 * フェーズ1(リポジトリパターン導入): `src/lib/employmentIncome.ts`が直接
 * `prisma.employmentIncomeRecord`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { EmploymentIncomeRecord } from "@prisma/client";
import { prisma } from "../db";

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
