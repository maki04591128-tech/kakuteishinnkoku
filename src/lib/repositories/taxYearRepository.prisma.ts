/**
 * フェーズ5-1-3b: `TaxYearRepository`のPrisma実装(自宅サーバー版が使う)。
 * `../db`経由で`@prisma/client`(Node専用)に依存するため、クライアント実装
 * (`createClientTaxYearRepository`。`taxYearRepository.ts`)とは別ファイルにする。
 * これにより、スタンドアロン版ビルドで`@/lib/repositories/defaultTaxYearRepository`を
 * `defaultTaxYearRepository.standalone.ts`に差し替えた際、このファイル(と
 * `@prisma/client`本体)がバンドルに引き込まれない。
 */
import { prisma } from "../db";
import type { TaxYearRepository } from "./taxYearRepository";
import type { CryptoCostMethod, TaxYear } from "@prisma/client";

export function createPrismaTaxYearRepository(): TaxYearRepository {
  return {
    async getOrCreateTaxYear(year: number): Promise<TaxYear> {
      return prisma.taxYear.upsert({
        where: { year },
        create: { year },
        update: {},
      });
    },

    async findByYear(year: number): Promise<TaxYear | null> {
      return prisma.taxYear.findUnique({ where: { year } });
    },

    async listTaxYears(): Promise<number[]> {
      const years = await prisma.taxYear.findMany({
        orderBy: { year: "desc" },
        select: { year: true },
      });
      return years.map((y) => y.year);
    },

    async updateCryptoCostMethod(id: number, cryptoCostMethod: CryptoCostMethod): Promise<void> {
      await prisma.taxYear.update({
        where: { id },
        data: { cryptoCostMethod },
      });
    },
  };
}
