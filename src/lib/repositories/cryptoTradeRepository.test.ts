/**
 * フェーズ2-34: `createClientCryptoTradeRepository`
 * (wa-sqlite実装)が`CryptoTradeRepository`インターフェースを、
 * Prisma実装(`createPrismaCryptoTradeRepository`)と
 * 同じ挙動で満たすことを検証する。
 */
import { Decimal } from "decimal.js";
import { afterEach, describe, expect, it } from "vitest";
import { applyClientDbSchema } from "../clientDb/schema";
import { openClientDb, type ClientDb } from "../clientDb/sqlite";
import { createClientCryptoTradeRepository } from "./cryptoTradeRepository";

describe("createClientCryptoTradeRepository", () => {
  const openDbs: ClientDb[] = [];

  async function setup(name: string) {
    const db = await openClientDb(name);
    openDbs.push(db);
    await applyClientDbSchema(db);
    return createClientCryptoTradeRepository(db);
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
      tradedAt: new Date("2026-03-01T00:00:00.000Z"),
      symbol: "BTC",
      type: "BUY",
      quantity: "0.123456789012345678",
      unitPriceJpy: "10000000",
      feeJpy: "100",
      exchange: "bitFlyer",
      memo: "積立購入",
      source: "manual",
    });
    expect(created.id).toBeTypeOf("number");
    expect(created.quantity).toBeInstanceOf(Decimal);
    expect(created.quantity.toString()).toBe("0.123456789012345678");

    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(1);
    expect(records[0].taxYearId).toBe(1);
    expect(records[0].symbol).toBe("BTC");
    expect(records[0].type).toBe("BUY");
    expect(records[0].unitPriceJpy.toString()).toBe("10000000");
    expect(records[0].feeJpy.toString()).toBe("100");
    expect(records[0].marketValueUnitPriceJpy).toBeNull();
    expect(records[0].exchange).toBe("bitFlyer");
    expect(records[0].memo).toBe("積立購入");
    expect(records[0].source).toBe("manual");
    expect(records[0].importBatchId).toBeNull();
    expect(records[0].tradedAt.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(records[0].createdAt).toBeInstanceOf(Date);
    expect(records[0].updatedAt).toBeInstanceOf(Date);
  });

  it("marketValueUnitPriceJpyがnullでない場合も往復できる(低額譲渡用)", async () => {
    const repo = await setup("test-market-value.db");
    await repo.create({
      taxYearId: 1,
      tradedAt: new Date("2026-03-01T00:00:00.000Z"),
      symbol: "BTC",
      type: "LOW_PRICE_TRANSFER_OUT",
      quantity: "1",
      unitPriceJpy: "100",
      marketValueUnitPriceJpy: "1000",
      feeJpy: "0",
    });
    const [record] = await repo.findByTaxYearId(1);
    expect(record.marketValueUnitPriceJpy).toBeInstanceOf(Decimal);
    expect(record.marketValueUnitPriceJpy?.toString()).toBe("1000");
  });

  it("deleteで指定したidの行のみ削除される", async () => {
    const repo = await setup("test-delete.db");
    const first = await repo.create({
      taxYearId: 1,
      tradedAt: new Date("2026-01-01T00:00:00.000Z"),
      symbol: "BTC",
      type: "BUY",
      quantity: "1",
      unitPriceJpy: "100",
      feeJpy: "0",
    });
    const second = await repo.create({
      taxYearId: 1,
      tradedAt: new Date("2026-02-01T00:00:00.000Z"),
      symbol: "ETH",
      type: "BUY",
      quantity: "1",
      unitPriceJpy: "200",
      feeJpy: "0",
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
      sourceType: "moneyforward_crypto",
      fileName: "crypto.csv",
      rows: [
        {
          tradedAt: new Date("2026-01-01T00:00:00.000Z"),
          symbol: "BTC",
          type: "BUY",
          quantity: "0.5",
          unitPriceJpy: "9000000",
          feeJpy: "50",
          exchange: "bitFlyer",
          memo: null,
          source: "moneyforward",
        },
        {
          tradedAt: new Date("2026-01-02T00:00:00.000Z"),
          symbol: "ETH",
          type: "SELL",
          quantity: "2",
          unitPriceJpy: "500000",
          feeJpy: "10",
          exchange: null,
          memo: "メモ",
          source: "moneyforward",
        },
      ],
    });

    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(2);
    const btc = records.find((r) => r.symbol === "BTC");
    expect(btc?.quantity.toString()).toBe("0.5");
    expect(btc?.importBatchId).toBeTypeOf("number");
    expect(btc?.exchange).toBe("bitFlyer");
    const eth = records.find((r) => r.symbol === "ETH");
    expect(eth?.memo).toBe("メモ");
    expect(eth?.exchange).toBeNull();
  });

  it("importCsvBatchでrowsが空配列の場合はImportBatchのみ登録される", async () => {
    const repo = await setup("test-import-empty.db");
    await repo.importCsvBatch({
      taxYearId: 1,
      sourceType: "moneyforward_crypto",
      fileName: "empty.csv",
      rows: [],
    });
    expect(await repo.findByTaxYearId(1)).toEqual([]);
  });
});
