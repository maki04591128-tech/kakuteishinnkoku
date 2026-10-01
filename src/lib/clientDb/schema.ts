/**
 * スタンドアロン(Android)版のクライアントサイドDBスキーマ(フェーズ2)。
 *
 * `prisma/schema.prisma`の各モデルに対応するCREATE TABLE文を、フェーズ1の
 * リポジトリインターフェースを1つ実装するたびにここへ追加していく。列名は
 * Prismaスキーマのフィールド名をsnake_caseにしたもの、Decimal相当の列は
 * フェーズ0-3で決定した通りTEXT型(`decimalCodec.ts`で変換)とする。
 */
import type { ClientDb } from "./sqlite";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS tax_year (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL UNIQUE,
    crypto_cost_method TEXT NOT NULL DEFAULT 'AVERAGE',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS login_attempt (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS login_attempt_ip_address_created_at_idx
    ON login_attempt (ip_address, created_at)`,
  `CREATE TABLE IF NOT EXISTS employment_income_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL UNIQUE,
    gross_salary_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS barrier_free_renovation_deduction_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL UNIQUE,
    credit_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS earthquake_renovation_deduction_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL UNIQUE,
    credit_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS energy_saving_renovation_deduction_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL UNIQUE,
    credit_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS multi_household_renovation_deduction_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL UNIQUE,
    credit_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS durability_improvement_renovation_deduction_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL UNIQUE,
    credit_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS child_rearing_renovation_deduction_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL UNIQUE,
    credit_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS certified_housing_construction_credit_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL UNIQUE,
    credit_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS certified_housing_construction_credit_carryforward (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL UNIQUE,
    origin_year INTEGER NOT NULL,
    remaining_amount_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS investment_loss_carryforward (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL,
    origin_year INTEGER NOT NULL,
    remaining_amount_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tax_year_id, origin_year)
  )`,
  `CREATE TABLE IF NOT EXISTS futures_loss_carryforward (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL,
    origin_year INTEGER NOT NULL,
    remaining_amount_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tax_year_id, origin_year)
  )`,
  `CREATE TABLE IF NOT EXISTS angel_tax_loss_carryforward (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL,
    origin_year INTEGER NOT NULL,
    remaining_amount_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tax_year_id, origin_year)
  )`,
  `CREATE TABLE IF NOT EXISTS foreign_tax_credit_carryforward (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL,
    origin_year INTEGER NOT NULL,
    remaining_amount_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tax_year_id, origin_year)
  )`,
  `CREATE TABLE IF NOT EXISTS foreign_tax_credit_spare_limit_carryforward (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL,
    origin_year INTEGER NOT NULL,
    remaining_amount_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tax_year_id, origin_year)
  )`,
  `CREATE TABLE IF NOT EXISTS casualty_loss_carryforward (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL,
    origin_year INTEGER NOT NULL,
    remaining_amount_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tax_year_id, origin_year)
  )`,
  `CREATE TABLE IF NOT EXISTS home_sale_loss_carryforward (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL,
    origin_year INTEGER NOT NULL,
    remaining_amount_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tax_year_id, origin_year)
  )`,
  `CREATE TABLE IF NOT EXISTS home_replacement_loss_carryforward (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL,
    origin_year INTEGER NOT NULL,
    remaining_amount_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tax_year_id, origin_year)
  )`,
  `CREATE TABLE IF NOT EXISTS donation_tax_credit_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL UNIQUE,
    total_tax_credit_jpy TEXT NOT NULL,
    resident_tax_basic_deduction_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS mortgage_deduction_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL UNIQUE,
    national_tax_credit_jpy TEXT NOT NULL,
    resident_tax_credit_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS resident_tax_adjustment_deduction_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL UNIQUE,
    adjustment_deduction_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS distribution_adjusted_foreign_tax_credit_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL UNIQUE,
    credit_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS foreign_tax_credit_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL UNIQUE,
    total_tax_credit_jpy TEXT NOT NULL,
    national_tax_credit_jpy TEXT NOT NULL,
    resident_tax_credit_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS nisa_lifetime_quota (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL,
    nisa_type TEXT NOT NULL,
    opening_used_jpy TEXT NOT NULL,
    sold_cost_basis_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tax_year_id, nisa_type)
  )`,
  `CREATE TABLE IF NOT EXISTS income_deduction (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    income_tax_amount_jpy TEXT NOT NULL,
    resident_tax_amount_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tax_year_id, type)
  )`,
];

/** 未作成のテーブルを作成する(既存テーブルには影響しない)。 */
export async function applyClientDbSchema(db: ClientDb): Promise<void> {
  for (const statement of STATEMENTS) {
    await db.run(statement);
  }
}
