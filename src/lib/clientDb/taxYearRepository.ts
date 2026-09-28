/**
 * フェーズ0-2 PoC: `src/lib/taxYear.ts`(Prisma版)相当のCRUDを、
 * wa-sqlite(クライアントサイドDB候補)で実装できるか検証する。
 * フェーズ1で導入するリポジトリインターフェースはまだ定義しておらず、
 * ここでは技術検証としてPrisma版と同じ2関数のみを素朴に実装する。
 */
import { openClientDb, type ClientDb } from "./sqlite";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS tax_year (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL UNIQUE,
    crypto_cost_method TEXT NOT NULL DEFAULT 'AVERAGE',
    created_at TEXT NOT NULL
  )
`;

export async function createTaxYearClientDb(name: string): Promise<ClientDb> {
  const db = await openClientDb(name);
  await db.run(SCHEMA);
  return db;
}

export interface TaxYearRow {
  year: number;
  crypto_cost_method: string;
}

export async function getOrCreateTaxYear(
  db: ClientDb,
  year: number,
): Promise<TaxYearRow> {
  await db.run(
    `INSERT INTO tax_year (year, created_at) VALUES (?, ?)
     ON CONFLICT(year) DO NOTHING`,
    [year, new Date().toISOString()],
  );
  const rows = await db.all(
    `SELECT year, crypto_cost_method FROM tax_year WHERE year = ?`,
    [year],
  );
  const row = rows[0];
  return {
    year: Number(row.year),
    crypto_cost_method: String(row.crypto_cost_method),
  };
}

export async function listTaxYears(db: ClientDb): Promise<number[]> {
  const rows = await db.all(`SELECT year FROM tax_year ORDER BY year DESC`);
  return rows.map((row) => Number(row.year));
}
