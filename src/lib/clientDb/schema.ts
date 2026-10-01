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
  `CREATE TABLE IF NOT EXISTS opening_balance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL,
    asset_class TEXT NOT NULL,
    symbol TEXT NOT NULL,
    is_nisa INTEGER NOT NULL,
    is_listed INTEGER NOT NULL,
    quantity TEXT NOT NULL,
    cost_basis_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tax_year_id, asset_class, symbol, is_nisa, is_listed)
  )`,
  `CREATE TABLE IF NOT EXISTS opening_balance_by_institution (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL,
    asset_class TEXT NOT NULL,
    symbol TEXT NOT NULL,
    institution TEXT NOT NULL,
    quantity TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tax_year_id, asset_class, symbol, institution)
  )`,
  `CREATE TABLE IF NOT EXISTS market_price (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL UNIQUE,
    price_jpy TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS asset_symbol_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_name TEXT NOT NULL UNIQUE,
    symbol TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS broker_annual_report (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL,
    broker TEXT NOT NULL,
    account_type TEXT NOT NULL,
    proceeds_jpy TEXT NOT NULL,
    acquisition_cost_jpy TEXT NOT NULL,
    dividend_jpy TEXT NOT NULL,
    memo TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (tax_year_id, broker, account_type)
  )`,
  `CREATE TABLE IF NOT EXISTS import_batch (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL,
    source_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    imported_at TEXT NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS asset_balance_snapshot (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL,
    snapshot_date TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    institution TEXT NOT NULL,
    asset_name TEXT NOT NULL,
    balance_jpy TEXT NOT NULL,
    quantity TEXT,
    import_batch_id INTEGER,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS asset_balance_snapshot_tax_year_id_institution_idx
    ON asset_balance_snapshot (tax_year_id, institution)`,
  `CREATE TABLE IF NOT EXISTS cashflow_entry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_batch_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    content TEXT NOT NULL,
    amount_jpy TEXT NOT NULL,
    direction TEXT NOT NULL,
    large_category TEXT,
    middle_category TEXT,
    institution TEXT,
    memo TEXT,
    is_calculation_target INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cashflow_entry_date_idx ON cashflow_entry (date)`,
  `CREATE INDEX IF NOT EXISTS cashflow_entry_large_category_middle_category_idx
    ON cashflow_entry (large_category, middle_category)`,
  `CREATE TABLE IF NOT EXISTS crypto_trade (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL,
    traded_at TEXT NOT NULL,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity TEXT NOT NULL,
    unit_price_jpy TEXT NOT NULL,
    market_value_unit_price_jpy TEXT,
    fee_jpy TEXT NOT NULL DEFAULT '0',
    exchange TEXT,
    memo TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    import_batch_id INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS crypto_trade_tax_year_id_symbol_idx
    ON crypto_trade (tax_year_id, symbol)`,
  `CREATE INDEX IF NOT EXISTS crypto_trade_traded_at_idx ON crypto_trade (traded_at)`,
  `CREATE TABLE IF NOT EXISTS crypto_margin_trade (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL,
    settled_at TEXT NOT NULL,
    symbol TEXT NOT NULL,
    realized_pnl_jpy TEXT NOT NULL,
    fee_jpy TEXT NOT NULL DEFAULT '0',
    swap_jpy TEXT NOT NULL DEFAULT '0',
    exchange TEXT,
    memo TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    import_batch_id INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS crypto_margin_trade_tax_year_id_symbol_idx
    ON crypto_margin_trade (tax_year_id, symbol)`,
  `CREATE INDEX IF NOT EXISTS crypto_margin_trade_settled_at_idx
    ON crypto_margin_trade (settled_at)`,
  `CREATE TABLE IF NOT EXISTS crypto_credit_trade (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tax_year_id INTEGER NOT NULL,
    settled_at TEXT NOT NULL,
    symbol TEXT NOT NULL,
    realized_pnl_jpy TEXT NOT NULL,
    fee_jpy TEXT NOT NULL DEFAULT '0',
    interest_adjustment_jpy TEXT NOT NULL DEFAULT '0',
    exchange TEXT,
    memo TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS crypto_credit_trade_tax_year_id_symbol_idx
    ON crypto_credit_trade (tax_year_id, symbol)`,
  `CREATE INDEX IF NOT EXISTS crypto_credit_trade_settled_at_idx
    ON crypto_credit_trade (settled_at)`,
];

/** 未作成のテーブルを作成する(既存テーブルには影響しない)。 */
export async function applyClientDbSchema(db: ClientDb): Promise<void> {
  for (const statement of STATEMENTS) {
    await db.run(statement);
  }
}
