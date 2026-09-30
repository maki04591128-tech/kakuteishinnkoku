/**
 * フェーズ1(リポジトリパターン導入): `src/lib/taxYear.ts`が直接
 * `prisma.taxYear`を呼んでいた処理をこのインターフェース経由に置き換える。
 * 自宅サーバー版は`createPrismaTaxYearRepository`を使い続け、スタンドアロン
 * (Android)版はフェーズ2で追加した`createClientTaxYearRepository`
 * (wa-sqlite実装)を使う。挙動は既存のPrisma実装と完全に一致させる。
 */
import type { CryptoCostMethod, TaxYear } from "@prisma/client";
import { prisma } from "../db";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

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

function rowToTaxYear(row: Record<string, SqlValue>): TaxYear {
  return {
    id: Number(row.id),
    year: Number(row.year),
    cryptoCostMethod: String(row.crypto_cost_method) as CryptoCostMethod,
    createdAt: new Date(String(row.created_at)),
  };
}

async function findClientTaxYearByYear(db: ClientDb, year: number): Promise<TaxYear | null> {
  const rows = await db.all(
    `SELECT id, year, crypto_cost_method, created_at FROM tax_year WHERE year = ?`,
    [year],
  );
  const row = rows[0];
  return row ? rowToTaxYear(row) : null;
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-1)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientTaxYearRepository(db: ClientDb): TaxYearRepository {
  return {
    async getOrCreateTaxYear(year: number): Promise<TaxYear> {
      await db.run(
        `INSERT INTO tax_year (year, created_at) VALUES (?, ?)
         ON CONFLICT(year) DO NOTHING`,
        [year, new Date().toISOString()],
      );
      const taxYear = await findClientTaxYearByYear(db, year);
      if (!taxYear) {
        throw new Error(`getOrCreateTaxYear: failed to create tax_year for year=${year}`);
      }
      return taxYear;
    },

    async findByYear(year: number): Promise<TaxYear | null> {
      return findClientTaxYearByYear(db, year);
    },

    async listTaxYears(): Promise<number[]> {
      const rows = await db.all(`SELECT year FROM tax_year ORDER BY year DESC`);
      return rows.map((row) => Number(row.year));
    },

    async updateCryptoCostMethod(id: number, cryptoCostMethod: CryptoCostMethod): Promise<void> {
      await db.run(`UPDATE tax_year SET crypto_cost_method = ? WHERE id = ?`, [
        cryptoCostMethod,
        id,
      ]);
    },
  };
}
