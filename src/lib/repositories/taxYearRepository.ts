/**
 * フェーズ1(リポジトリパターン導入): `src/lib/taxYear.ts`が直接
 * `prisma.taxYear`を呼んでいた処理をこのインターフェース経由に置き換える。
 * 自宅サーバー版は`createPrismaTaxYearRepository`を使い続け、スタンドアロン
 * (Android)版ではフェーズ2でクライアントサイドDB実装をこのインターフェースに
 * 合わせて追加する想定。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { CryptoCostMethod, TaxYear } from "@prisma/client";
import { prisma } from "../db";

export interface TaxYearRepository {
  getOrCreateTaxYear(year: number): Promise<TaxYear>;
  findByYear(year: number): Promise<TaxYear | null>;
  listTaxYears(): Promise<number[]>;
  updateCryptoCostMethod(id: number, cryptoCostMethod: CryptoCostMethod): Promise<void>;
}

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
