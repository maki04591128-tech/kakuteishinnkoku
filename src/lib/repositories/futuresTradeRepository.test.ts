/**
 * フェーズ2-38: `createClientFuturesTradeRepository`
 * (wa-sqlite実装)が`FuturesTradeRepository`インターフェースを、
 * Prisma実装(`createPrismaFuturesTradeRepository`)と
 * 同じ挙動で満たすことを検証する。
 */
import { Decimal } from "decimal.js";
import { afterEach, describe, expect, it } from "vitest";
import { applyClientDbSchema } from "../clientDb/schema";
import { openClientDb, type ClientDb } from "../clientDb/sqlite";
import { createClientFuturesTradeRepository } from "./futuresTradeRepository";

describe("createClientFuturesTradeRepository", () => {
  const openDbs: ClientDb[] = [];

  async function setup(name: string) {
    const db = await openClientDb(name);
    openDbs.push(db);
    await applyClientDbSchema(db);
    return createClientFuturesTradeRepository(db);
  }

  afterEach(async () => {
    while (openDbs.length > 0) {
      await openDbs.pop()?.close();
    }
  });

  it("findByTaxYearIdは未登録のtaxYearIdに対して空配列を返す", async () => {
    const repo = await setup("test-find-missing.db");
    expect(await repo.findByTaxYearId(1)).toEqual([]);
  });

  it("createで登録した内容をfindByTaxYearIdで取得できる", async () => {
    const repo = await setup("test-create.db");
    const created = await repo.create({
      taxYearId: 1,
      settledAt: new Date("2026-03-01T00:00:00.000Z"),
      symbol: "日経225先物",
      realizedPnlJpy: "-0.123456789012345678",
      feeJpy: "100",
      swapJpy: "-50",
      broker: "SBI証券",
      memo: "ロスカット",
      source: "manual",
    });
    expect(created.id).toBeTypeOf("number");
    expect(created.realizedPnlJpy).toBeInstanceOf(Decimal);
    expect(created.realizedPnlJpy.toString()).toBe("-0.123456789012345678");

    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(1);
    expect(records[0].taxYearId).toBe(1);
    expect(records[0].symbol).toBe("日経225先物");
    expect(records[0].feeJpy.toString()).toBe("100");
    expect(records[0].swapJpy.toString()).toBe("-50");
    expect(records[0].broker).toBe("SBI証券");
    expect(records[0].memo).toBe("ロスカット");
    expect(records[0].source).toBe("manual");
    expect(records[0].importBatchId).toBeNull();
    expect(records[0].settledAt.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(records[0].createdAt).toBeInstanceOf(Date);
    expect(records[0].updatedAt).toBeInstanceOf(Date);
  });

  it("feeJpy・swapJpyを省略した場合はデフォルト値0が使われる", async () => {
    const repo = await setup("test-default.db");
    const created = await repo.create({
      taxYearId: 1,
      settledAt: new Date("2026-01-01T00:00:00.000Z"),
      symbol: "USD/JPY",
      realizedPnlJpy: "1000",
    });
    expect(created.feeJpy.toString()).toBe("0");
    expect(created.swapJpy.toString()).toBe("0");
  });

  it("deleteで指定したidの行のみ削除される", async () => {
    const repo = await setup("test-delete.db");
    const first = await repo.create({
      taxYearId: 1,
      settledAt: new Date("2026-01-01T00:00:00.000Z"),
      symbol: "日経225先物",
      realizedPnlJpy: "100",
    });
    const second = await repo.create({
      taxYearId: 1,
      settledAt: new Date("2026-02-01T00:00:00.000Z"),
      symbol: "USD/JPY",
      realizedPnlJpy: "200",
    });
    await repo.delete(first.id);
    const remaining = await repo.findByTaxYearId(1);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
  });

  it("importCsvBatchで複数行を一括登録できる", async () => {
    const repo = await setup("test-import.db");
    await repo.importCsvBatch({
      taxYearId: 1,
      sourceType: "moneyforward_futures",
      fileName: "futures.csv",
      rows: [
        {
          settledAt: new Date("2026-01-01T00:00:00.000Z"),
          symbol: "日経225先物",
          realizedPnlJpy: "500",
          feeJpy: "50",
          swapJpy: "-10",
          broker: "SBI証券",
          source: "moneyforward",
        },
        {
          settledAt: new Date("2026-01-02T00:00:00.000Z"),
          symbol: "USD/JPY",
          realizedPnlJpy: "-200",
          feeJpy: "10",
          swapJpy: "0",
          broker: null,
          source: "moneyforward",
        },
      ],
    });

    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(2);
    const nikkei = records.find((r) => r.symbol === "日経225先物");
    expect(nikkei?.realizedPnlJpy.toString()).toBe("500");
    expect(nikkei?.importBatchId).toBeTypeOf("number");
    expect(nikkei?.broker).toBe("SBI証券");
    const usdJpy = records.find((r) => r.symbol === "USD/JPY");
    expect(usdJpy?.realizedPnlJpy.toString()).toBe("-200");
    expect(usdJpy?.broker).toBeNull();
  });

  it("importCsvBatchでrowsが空配列の場合はImportBatchのみ登録される", async () => {
    const repo = await setup("test-import-empty.db");
    await repo.importCsvBatch({
      taxYearId: 1,
      sourceType: "moneyforward_futures",
      fileName: "empty.csv",
      rows: [],
    });
    expect(await repo.findByTaxYearId(1)).toEqual([]);
  });
});
