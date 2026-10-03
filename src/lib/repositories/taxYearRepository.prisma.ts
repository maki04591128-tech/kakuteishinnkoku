/**
 * フェーズ5-1-3b: `TaxYearRepository`のPrisma実装(`../db`経由で`@prisma/client`に
 * 依存する部分)を`taxYearRepository.ts`から分離したファイル。スタンドアロン版の
 * デフォルト実装(`defaultTaxYearRepository.standalone.ts`)は`taxYearRepository.ts`
 * (クライアント実装のみ)だけを参照し、このファイルは一切importしないため、
 * スタンドアロン版バンドルにPrisma(Node専用、WebViewで動作不可)が
 * 引き込まれない。
 */
import type { CryptoCostMethod, TaxYear } from "@prisma/client";
import { prisma } from "../db";
import type { TaxYearRepository } from "./taxYearRepository";

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
