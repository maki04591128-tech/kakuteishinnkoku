/**
 * フェーズ1(リポジトリパターン導入): `src/lib/reporting.ts`・`src/app/actions.ts`が
 * 直接`prisma.investmentTrade`を呼んでいた処理をこのインターフェース経由に
 * 置き換える。挙動は既存のPrisma実装と完全に一致させる。
 * (`src/app/import/page.tsx`側の`prisma.investmentTrade`呼び出しは
 * 移行時に別途このリポジトリへ委譲する)
 * フェーズ2-39でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientInvestmentTradeRepository`。wa-sqlite)を追加した。
 */
import {
  Prisma,
  type InvestmentAccountType,
  type InvestmentAssetType,
  type InvestmentNisaType,
  type InvestmentTrade,
  type InvestmentTradeType,
} from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "../db";
import { decodeBoolean, encodeBoolean } from "../clientDb/booleanCodec";
import { encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface InvestmentTradeRepository {
  findByTaxYearId(taxYearId: number): Promise<InvestmentTrade[]>;
  create(data: Prisma.InvestmentTradeUncheckedCreateInput): Promise<InvestmentTrade>;
  delete(id: number): Promise<void>;
}

export function createPrismaInvestmentTradeRepository(): InvestmentTradeRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<InvestmentTrade[]> {
      return prisma.investmentTrade.findMany({ where: { taxYearId } });
    },

    async create(
      data: Prisma.InvestmentTradeUncheckedCreateInput,
    ): Promise<InvestmentTrade> {
      return prisma.investmentTrade.create({ data });
    },

    async delete(id: number): Promise<void> {
      await prisma.investmentTrade.delete({ where: { id } });
    },
  };
}

function rowToInvestmentTrade(row: Record<string, SqlValue>): InvestmentTrade {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    tradedAt: new Date(String(row.traded_at)),
    symbol: String(row.symbol),
    name: row.name === null ? null : String(row.name),
    assetType: String(row.asset_type) as InvestmentAssetType,
    isReit: decodeBoolean(Number(row.is_reit)),
    mutualFundHighForeignRatio: decodeBoolean(
      Number(row.mutual_fund_high_foreign_ratio),
    ),
    mutualFundVeryHighForeignRatio: decodeBoolean(
      Number(row.mutual_fund_very_high_foreign_ratio),
    ),
    isListed: decodeBoolean(Number(row.is_listed)),
    type: String(row.type) as InvestmentTradeType,
    quantity: new Prisma.Decimal(String(row.quantity)),
    unitPriceJpy: new Prisma.Decimal(String(row.unit_price_jpy)),
    feeJpy: new Prisma.Decimal(String(row.fee_jpy)),
    accountType: String(row.account_type) as InvestmentAccountType,
    isNisa: decodeBoolean(Number(row.is_nisa)),
    nisaType: row.nisa_type === null ? null : (String(row.nisa_type) as InvestmentNisaType),
    isForeign: decodeBoolean(Number(row.is_foreign)),
    foreignTaxWithheldJpy: new Prisma.Decimal(String(row.foreign_tax_withheld_jpy)),
    distributionAdjustedForeignTaxJpy: new Prisma.Decimal(
      String(row.distribution_adjusted_foreign_tax_jpy),
    ),
    broker: row.broker === null ? null : String(row.broker),
    memo: row.memo === null ? null : String(row.memo),
    source: String(row.source),
    importBatchId: row.import_batch_id === null ? null : Number(row.import_batch_id),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

const SELECT_COLUMNS = `id, tax_year_id, traded_at, symbol, name, asset_type, is_reit,
                mutual_fund_high_foreign_ratio, mutual_fund_very_high_foreign_ratio,
                is_listed, type, quantity, unit_price_jpy, fee_jpy, account_type,
                is_nisa, nisa_type, is_foreign, foreign_tax_withheld_jpy,
                distribution_adjusted_foreign_tax_jpy, broker, memo, source,
                import_batch_id, created_at, updated_at`;

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-39)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientInvestmentTradeRepository(
  db: ClientDb,
): InvestmentTradeRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<InvestmentTrade[]> {
      const rows = await db.all(
        `SELECT ${SELECT_COLUMNS}
         FROM investment_trade
         WHERE tax_year_id = ?`,
        [taxYearId],
      );
      return rows.map(rowToInvestmentTrade);
    },

    async create(
      data: Prisma.InvestmentTradeUncheckedCreateInput,
    ): Promise<InvestmentTrade> {
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO investment_trade
           (tax_year_id, traded_at, symbol, name, asset_type, is_reit,
            mutual_fund_high_foreign_ratio, mutual_fund_very_high_foreign_ratio,
            is_listed, type, quantity, unit_price_jpy, fee_jpy, account_type,
            is_nisa, nisa_type, is_foreign, foreign_tax_withheld_jpy,
            distribution_adjusted_foreign_tax_jpy, broker, memo, source,
            import_batch_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          Number(data.taxYearId),
          new Date(data.tradedAt as string | Date).toISOString(),
          String(data.symbol),
          data.name === null || data.name === undefined ? null : String(data.name),
          String(data.assetType),
          encodeBoolean(Boolean(data.isReit ?? false)),
          encodeBoolean(Boolean(data.mutualFundHighForeignRatio ?? false)),
          encodeBoolean(Boolean(data.mutualFundVeryHighForeignRatio ?? false)),
          encodeBoolean(data.isListed === undefined ? true : Boolean(data.isListed)),
          String(data.type),
          encodeDecimal(new Decimal(String(data.quantity))),
          encodeDecimal(new Decimal(String(data.unitPriceJpy))),
          encodeDecimal(new Decimal(String(data.feeJpy ?? "0"))),
          data.accountType === undefined
            ? "SPECIFIC_WITHHOLDING"
            : String(data.accountType),
          encodeBoolean(Boolean(data.isNisa ?? false)),
          data.nisaType === null || data.nisaType === undefined
            ? null
            : String(data.nisaType),
          encodeBoolean(Boolean(data.isForeign ?? false)),
          encodeDecimal(new Decimal(String(data.foreignTaxWithheldJpy ?? "0"))),
          encodeDecimal(
            new Decimal(String(data.distributionAdjustedForeignTaxJpy ?? "0")),
          ),
          data.broker === null || data.broker === undefined
            ? null
            : String(data.broker),
          data.memo === null || data.memo === undefined ? null : String(data.memo),
          data.source === undefined ? "manual" : String(data.source),
          data.importBatchId === null || data.importBatchId === undefined
            ? null
            : Number(data.importBatchId),
          now,
          now,
        ],
      );
      const [{ id: rawId }] = await db.all(`SELECT last_insert_rowid() AS id`);
      const [row] = await db.all(
        `SELECT ${SELECT_COLUMNS}
         FROM investment_trade WHERE id = ?`,
        [Number(rawId)],
      );
      return rowToInvestmentTrade(row);
    },

    async delete(id: number): Promise<void> {
      await db.run(`DELETE FROM investment_trade WHERE id = ?`, [id]);
    },
  };
}
