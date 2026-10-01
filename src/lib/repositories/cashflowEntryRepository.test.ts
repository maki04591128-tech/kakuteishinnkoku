/**
 * フェーズ2-33: `createClientCashflowEntryRepository`(wa-sqlite実装)が
 * `CashflowEntryRepository`インターフェースを、Prisma実装
 * (`createPrismaCashflowEntryRepository`)と同じ挙動で満たすことを検証する。
 * `CashflowEntryRepository`は書き込み専用インターフェース(`importMoneyForwardCsv`)
 * のため、登録結果はクライアントDBのテーブルを直接SELECTして確認する。
 */
import { afterEach, describe, expect, it } from "vitest";
import { applyClientDbSchema } from "../clientDb/schema";
import { openClientDb, type ClientDb } from "../clientDb/sqlite";
import { createClientCashflowEntryRepository } from "./cashflowEntryRepository";

describe("createClientCashflowEntryRepository", () => {
  const openDbs: ClientDb[] = [];

  async function setup(name: string) {
    const db = await openClientDb(name);
    openDbs.push(db);
    await applyClientDbSchema(db);
    return { repo: createClientCashflowEntryRepository(db), db };
  }

  afterEach(async () => {
    while (openDbs.length > 0) {
      await openDbs.pop()?.close();
    }
  });

  it("importMoneyForwardCsvでImportBatchとCashflowEntryが登録される", async () => {
    const { repo, db } = await setup("test-import.db");

    await repo.importMoneyForwardCsv({
      taxYearId: 1,
      fileName: "cashflow.csv",
      rows: [
        {
          date: new Date("2026-01-15T00:00:00.000Z"),
          content: "給与振込",
          amountJpy: "300000",
          direction: "INCOME",
          largeCategory: "収入",
          middleCategory: "給与",
          institution: "三菱UFJ銀行",
          memo: null,
          isCalculationTarget: true,
        },
        {
          date: new Date("2026-01-20T00:00:00.000Z"),
          content: "振替(集計対象外)",
          amountJpy: "50000",
          direction: "EXPENSE",
          largeCategory: null,
          middleCategory: null,
          institution: null,
          memo: "口座振替",
          isCalculationTarget: false,
        },
      ],
    });

    const batches = await db.all(
      `SELECT id, tax_year_id, source_type, file_name, row_count FROM import_batch`,
    );
    expect(batches).toHaveLength(1);
    expect(batches[0].tax_year_id).toBe(1);
    expect(batches[0].source_type).toBe("moneyforward_cashflow");
    expect(batches[0].file_name).toBe("cashflow.csv");
    expect(batches[0].row_count).toBe(2);

    const entries = await db.all(
      `SELECT * FROM cashflow_entry ORDER BY id`,
    );
    expect(entries).toHaveLength(2);

    const salary = entries[0];
    expect(salary.import_batch_id).toBe(batches[0].id);
    expect(salary.content).toBe("給与振込");
    expect(salary.amount_jpy).toBe("300000");
    expect(salary.direction).toBe("INCOME");
    expect(salary.large_category).toBe("収入");
    expect(salary.middle_category).toBe("給与");
    expect(salary.institution).toBe("三菱UFJ銀行");
    expect(salary.memo).toBeNull();
    expect(salary.is_calculation_target).toBe(1);
    expect(new Date(String(salary.date)).toISOString()).toBe(
      "2026-01-15T00:00:00.000Z",
    );

    const transfer = entries[1];
    expect(transfer.large_category).toBeNull();
    expect(transfer.institution).toBeNull();
    expect(transfer.memo).toBe("口座振替");
    expect(transfer.is_calculation_target).toBe(0);
  });

  it("rowsが空配列の場合はImportBatchのみ登録される", async () => {
    const { repo, db } = await setup("test-empty.db");

    await repo.importMoneyForwardCsv({
      taxYearId: 1,
      fileName: "empty.csv",
      rows: [],
    });

    const batches = await db.all(`SELECT row_count FROM import_batch`);
    expect(batches).toHaveLength(1);
    expect(batches[0].row_count).toBe(0);
    expect(await db.all(`SELECT * FROM cashflow_entry`)).toEqual([]);
  });
});
