/**
 * フェーズ5-1-3b: `IncomeDeductionRepository`のPrisma実装
 * (自宅サーバー版が使う)。`../db`経由で`@prisma/client`(Node専用)に依存するため、
 * クライアント実装(`createClientIncomeDeductionRepository`。
 * `incomeDeductionRepository.ts`)とは別ファイルにする。これにより、
 * スタンドアロン版ビルドで`@/lib/repositories/defaultIncomeDeductionRepository`を
 * `defaultIncomeDeductionRepository.standalone.ts`に差し替えた際、
 * このファイル(と`@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { IncomeDeductionRepository } from "./incomeDeductionRepository";
import type { IncomeDeduction, IncomeDeductionType } from "@prisma/client";

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
