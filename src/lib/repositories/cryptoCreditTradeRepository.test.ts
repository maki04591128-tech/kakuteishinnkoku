/**
 * フェーズ2-36: `createClientCryptoCreditTradeRepository`
 * (wa-sqlite実装)が`CryptoCreditTradeRepository`インターフェースを、
 * Prisma実装(`createPrismaCryptoCreditTradeRepository`)と
 * 同じ挙動で満たすことを検証する。
 */
import { Decimal } from "decimal.js";
import { afterEach, describe, expect, it } from "vitest";
import { applyClientDbSchema } from "../clientDb/schema";
import { openClientDb, type ClientDb } from "../clientDb/sqlite";
import { createClientCryptoCreditTradeRepository } from "./cryptoCreditTradeRepository";

describe("createClientCryptoCreditTradeRepository", () => {
  const openDbs: ClientDb[] = [];

  async function setup(name: string) {
    const db = await openClientDb(name);
    openDbs.push(db);
    await applyClientDbSchema(db);
    return createClientCryptoCreditTradeRepository(db);
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
      symbol: "BTC",
      realizedPnlJpy: "-0.123456789012345678",
      feeJpy: "100",
      interestAdjustmentJpy: "-50",
      exchange: "GMOコイン",
      memo: "信用取引決済",
    });
    expect(created.id).toBeTypeOf("number");
    expect(created.realizedPnlJpy).toBeInstanceOf(Decimal);
    expect(created.realizedPnlJpy.toString()).toBe("-0.123456789012345678");

    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(1);
    expect(records[0].taxYearId).toBe(1);
    expect(records[0].symbol).toBe("BTC");
    expect(records[0].feeJpy.toString()).toBe("100");
    expect(records[0].interestAdjustmentJpy.toString()).toBe("-50");
    expect(records[0].exchange).toBe("GMOコイン");
    expect(records[0].memo).toBe("信用取引決済");
    expect(records[0].settledAt.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(records[0].createdAt).toBeInstanceOf(Date);
    expect(records[0].updatedAt).toBeInstanceOf(Date);
  });

  it("feeJpy・interestAdjustmentJpyを省略した場合はデフォルト値0が使われる", async () => {
    const repo = await setup("test-default.db");
    const created = await repo.create({
      taxYearId: 1,
      settledAt: new Date("2026-01-01T00:00:00.000Z"),
      symbol: "ETH",
      realizedPnlJpy: "1000",
    });
    expect(created.feeJpy.toString()).toBe("0");
    expect(created.interestAdjustmentJpy.toString()).toBe("0");
  });

  it("deleteで指定したidの行のみ削除される", async () => {
    const repo = await setup("test-delete.db");
    const first = await repo.create({
      taxYearId: 1,
      settledAt: new Date("2026-01-01T00:00:00.000Z"),
      symbol: "BTC",
      realizedPnlJpy: "100",
    });
    const second = await repo.create({
      taxYearId: 1,
      settledAt: new Date("2026-02-01T00:00:00.000Z"),
      symbol: "ETH",
      realizedPnlJpy: "200",
    });
    await repo.delete(first.id);
    const remaining = await repo.findByTaxYearId(1);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
  });
});
