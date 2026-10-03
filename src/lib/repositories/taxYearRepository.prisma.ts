/**
 * フェーズ5-1-3b: `TaxYearRepository`のPrisma実装(自宅サーバー版専用)。
 * `../db`(`@prisma/client`の実体)に依存するため、スタンドアロン(Android)版
 * バンドルに引き込まれないよう`./taxYearRepository.ts`(型定義・クライアント実装)
 * とは別ファイルに分離している。利用側は`./defaultTaxYearRepository`経由で
 * ビルドターゲットに応じた既定実装を取得すること。
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
