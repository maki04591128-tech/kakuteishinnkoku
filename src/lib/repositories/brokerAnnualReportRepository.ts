/**
 * フェーズ1(リポジトリパターン導入): `src/app/actions.ts`・
 * `src/app/import/page.tsx`が直接`prisma.brokerAnnualReport`を呼んでいた
 * 処理をこのインターフェース経由に置き換える。挙動は既存のPrisma実装と
 * 完全に一致させる。
 * フェーズ2-31でスタンドアロン(Android)版向けのクライアントサイド実装
 * (`createClientBrokerAnnualReportRepository`。wa-sqlite)を追加した。
 * 自宅サーバー版は`createPrismaBrokerAnnualReportRepository`(フェーズ5-1-3bで
 * `brokerAnnualReportRepository.prisma.ts`に分離。`@prisma/client`(Node専用)に
 * 依存するため、このファイルからは分離しスタンドアロン版バンドルに引き込まれない
 * ようにする)を使う。ビルドターゲットに応じたどちらを使うかの既定の切り替えは
 * `defaultBrokerAnnualReportRepository.ts`/
 * `defaultBrokerAnnualReportRepository.standalone.ts`が担う。
 *
 * `proceedsJpy`/`acquisitionCostJpy`/`dividendJpy`の型
 * (`BrokerAnnualReport`の`Decimal`)は`@prisma/client`の値のみ`import type`で
 * 参照し、実体は`decimal.js`(`decimalCodec.ts`)で生成する(`@prisma/client`の
 * `Prisma.Decimal`は構造的に同一の別クラスだが、値としてのimportはスタンドアロン版
 * バンドルに`@prisma/client`本体を引き込んでしまうため使わない。`decimal.js`の
 * `Decimal`は型として互換なので代入可能)。
 */
import type { BrokerAnnualReport, InvestmentAccountType } from "@prisma/client";
import { Decimal } from "decimal.js";
import { decodeDecimal, encodeDecimal } from "../clientDb/decimalCodec";
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

function rowToBrokerAnnualReport(
  row: Record<string, SqlValue>,
): BrokerAnnualReport {
  return {
    id: Number(row.id),
    taxYearId: Number(row.tax_year_id),
    broker: String(row.broker),
    accountType: String(row.account_type) as InvestmentAccountType,
    proceedsJpy: decodeDecimal(String(row.proceeds_jpy)),
    acquisitionCostJpy: decodeDecimal(String(row.acquisition_cost_jpy)),
    dividendJpy: decodeDecimal(String(row.dividend_jpy)),
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
