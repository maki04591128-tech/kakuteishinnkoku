/**
 * フェーズ1(リポジトリパターン導入): `src/app/actions.ts`・
 * `src/app/import/page.tsx`が直接`prisma.brokerAnnualReport`を呼んでいた
 * 処理をこのインターフェース経由に置き換える。挙動は既存のPrisma実装と
 * 完全に一致させる。
 * フェーズ2-31でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientBrokerAnnualReportRepository`。wa-sqlite)を追加した。
 */
import {
  Prisma,
  type BrokerAnnualReport,
  type InvestmentAccountType,
} from "@prisma/client";
import { Decimal } from "decimal.js";
import { prisma } from "../db";
import { encodeDecimal } from "../clientDb/decimalCodec";
import type { ClientDb, SqlValue } from "../clientDb/sqlite";

export interface BrokerAnnualReportUpsertInput {
  taxYearId: number;
  broker: string;
  accountType: InvestmentAccountType;
  proceedsJpy: string;
  acquisitionCostJpy: string;
  dividendJpy: string;
}

export interface BrokerAnnualReportRepository {
  findByTaxYearId(taxYearId: number): Promise<BrokerAnnualReport[]>;
  upsert(input: BrokerAnnualReportUpsertInput): Promise<void>;
  delete(id: number): Promise<void>;
  upsertMany(inputs: BrokerAnnualReportUpsertInput[]): Promise<void>;
}

export function createPrismaBrokerAnnualReportRepository(): BrokerAnnualReportRepository {
  return {
    async findByTaxYearId(taxYearId: number): Promise<BrokerAnnualReport[]> {
      return prisma.brokerAnnualReport.findMany({
        where: { taxYearId },
        orderBy: [{ broker: "asc" }, { accountType: "asc" }],
      });
    },

    async upsert({
      taxYearId,
      broker,
      accountType,
      proceedsJpy,
      acquisitionCostJpy,
      dividendJpy,
    }): Promise<void> {
      await prisma.brokerAnnualReport.upsert({
        where: {
          taxYearId_broker_accountType: { taxYearId, broker, accountType },
        },
        create: {
          taxYearId,
          broker,
          accountType,
          proceedsJpy,
          acquisitionCostJpy,
          dividendJpy,
        },
        update: { proceedsJpy, acquisitionCostJpy, dividendJpy },
      });
    },

    async delete(id: number): Promise<void> {
      await prisma.brokerAnnualReport.delete({ where: { id } });
    },

    async upsertMany(inputs): Promise<void> {
      await prisma.$transaction(
        inputs.map((input) =>
          prisma.brokerAnnualReport.upsert({
            where: {
              taxYearId_broker_accountType: {
                taxYearId: input.taxYearId,
                broker: input.broker,
                accountType: input.accountType,
              },
            },
            create: {
              taxYearId: input.taxYearId,
              broker: input.broker,
              accountType: input.accountType,
              proceedsJpy: input.proceedsJpy,
              acquisitionCostJpy: input.acquisitionCostJpy,
              dividendJpy: input.dividendJpy,
            },
            update: {
              proceedsJpy: input.proceedsJpy,
              acquisitionCostJpy: input.acquisitionCostJpy,
              dividendJpy: input.dividendJpy,
            },
          }),
        ),
      );
    },
  };
}

function rowToBrokerAnnualReport(
  row: Record<string, SqlValue>,
): BrokerAnnualReport {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    broker: String(row.broker),
    accountType: String(row.account_type) as InvestmentAccountType,
    proceedsJpy: new Prisma.Decimal(String(row.proceeds_jpy)),
    acquisitionCostJpy: new Prisma.Decimal(String(row.acquisition_cost_jpy)),
    dividendJpy: new Prisma.Decimal(String(row.dividend_jpy)),
    memo: row.memo === null ? null : String(row.memo),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * スタンドアロン(Android)版向けのクライアントサイド実装(フェーズ2-31)。
 * `db`は呼び出し側で`applyClientDbSchema`済みの`ClientDb`を渡すこと。
 */
export function createClientBrokerAnnualReportRepository(
  db: ClientDb,
): BrokerAnnualReportRepository {
  async function upsertOne(input: BrokerAnnualReportUpsertInput): Promise<void> {
    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO broker_annual_report
         (tax_year_id, broker, account_type, proceeds_jpy,
          acquisition_cost_jpy, dividend_jpy, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tax_year_id, broker, account_type) DO UPDATE SET
         proceeds_jpy = excluded.proceeds_jpy,
         acquisition_cost_jpy = excluded.acquisition_cost_jpy,
         dividend_jpy = excluded.dividend_jpy,
         updated_at = excluded.updated_at`,
      [
        input.taxYearId,
        input.broker,
        input.accountType,
        encodeDecimal(new Decimal(input.proceedsJpy)),
        encodeDecimal(new Decimal(input.acquisitionCostJpy)),
        encodeDecimal(new Decimal(input.dividendJpy)),
        now,
        now,
      ],
    );
  }

  return {
    async findByTaxYearId(
      taxYearId: number,
    ): Promise<BrokerAnnualReport[]> {
      const rows = await db.all(
        `SELECT id, tax_year_id, broker, account_type, proceeds_jpy,
                acquisition_cost_jpy, dividend_jpy, memo, created_at, updated_at
         FROM broker_annual_report
         WHERE tax_year_id = ? ORDER BY broker, account_type`,
        [taxYearId],
      );
      return rows.map(rowToBrokerAnnualReport);
    },

    upsert: upsertOne,

    async delete(id: number): Promise<void> {
      await db.run(`DELETE FROM broker_annual_report WHERE id = ?`, [id]);
    },

    async upsertMany(inputs: BrokerAnnualReportUpsertInput[]): Promise<void> {
      for (const input of inputs) {
        await upsertOne(input);
      }
    },
  };
}
