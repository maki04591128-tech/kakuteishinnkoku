/**
 * フェーズ5-1-3b: `EmploymentIncomeRecordRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientEmploymentIncomeRecordRepository`。
 * `employmentIncomeRecordRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで`@/lib/repositories/defaultEmploymentIncomeRecordRepository`を
 * `defaultEmploymentIncomeRecordRepository.standalone.ts`に差し替えた際、このファイル
 * (と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { EmploymentIncomeRecordRepository } from "./employmentIncomeRecordRepository";
import type { EmploymentIncomeRecord } from "@prisma/client";

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
