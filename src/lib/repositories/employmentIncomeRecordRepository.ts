/**
 * フェーズ1(リポジトリパターン導入): `src/lib/employmentIncome.ts`が直接
 * `prisma.employmentIncomeRecord`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { EmploymentIncomeRecord } from "@prisma/client";
import { prisma } from "../db";

export interface EmploymentIncomeRecordRepository {
  findByTaxYearId(taxYearId: number): Promise<EmploymentIncomeRecord | null>;
}

export function createPrismaEmploymentIncomeRecordRepository(): EmploymentIncomeRecordRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<EmploymentIncomeRecord | null> {
      return prisma.employmentIncomeRecord.findUnique({ where: { taxYearId } });
    },
  };
}
