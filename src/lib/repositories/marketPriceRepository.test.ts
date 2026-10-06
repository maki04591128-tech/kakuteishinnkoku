/**
 * フェーズ2-29: `createClientMarketPriceRepository`(wa-sqlite実装)が
 * `MarketPriceRepository`インターフェースを、Prisma実装
 * (`createPrismaMarketPriceRepository`)と同じ挙動で満たすことを検証する。
 * フェーズ5-1-3b: Decimal列の復元を`decimalCodec.ts`の`decodeDecimal`
 * (`decimal.js`の`Decimal`)に変更したため、`priceJpy`の型チェックも
 * `@prisma/client`の`Prisma.Decimal`ではなく`decimal.js`の`Decimal`に変更している。
 */
import { Decimal } from "decimal.js";
import { afterEach, describe, expect, it } from "vitest";
import { applyClientDbSchema } from "../clientDb/schema";
import { openClientDb, type ClientDb } from "../clientDb/sqlite";
import { createClientMarketPriceRepository } from "./marketPriceRepository";

describe("createClientMarketPriceRepository", () => {
  const openDbs: ClientDb[] = [];

  async function setup(name: string) {
    const db = await openClientDb(name);
    openDbs.push(db);
    await applyClientDbSchema(db);
    return createClientMarketPriceRepository(db);
  }

  afterEach(async () => {
    while (openDbs.length > 0) {
      await openDbs.pop()?.close();
    }
  });

  it("findManyは未登録の場合に空配列を返す", async () => {
    const repo = await setup("test-find-empty.db");
    expect(await repo.findMany()).toEqual([]);
  });

  it("upsertで登録した内容をfindManyで取得できる", async () => {
    const repo = await setup("test-upsert.db");
    await repo.upsert({ symbol: "BTC", priceJpy: "12345678" });
    const records = await repo.findMany();
    expect(records).toHaveLength(1);
    expect(records[0].symbol).toBe("BTC");
    expect(records[0].priceJpy).toBeInstanceOf(Decimal);
    expect(records[0].priceJpy.toString()).toBe("12345678");
    expect(records[0].id).toBeTypeOf("number");
    expect(records[0].createdAt).toBeInstanceOf(Date);
    expect(records[0].updatedAt).toBeInstanceOf(Date);
  });

  it("同じsymbolで2回upsertしても1件のみ保持され、値が更新される(upsert相当)", async () => {
    const repo = await setup("test-idempotent.db");
    await repo.upsert({ symbol: "BTC", priceJpy: "100" });
    await repo.upsert({ symbol: "BTC", priceJpy: "200" });
    const records = await repo.findMany();
    expect(records).toHaveLength(1);
    expect(records[0].priceJpy.toString()).toBe("200");
  });

  it("symbolが異なれば別レコードとして保持される(一意制約)", async () => {
    const repo = await setup("test-unique.db");
    await repo.upsert({ symbol: "BTC", priceJpy: "100" });
    await repo.upsert({ symbol: "ETH", priceJpy: "50" });
    const records = await repo.findMany();
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.symbol).sort()).toEqual(["BTC", "ETH"]);
  });

  it("高精度な小数値を桁落ちなく往復できる(フェーズ0-3のDecimalCodec方式)", async () => {
    const repo = await setup("test-precision.db");
    await repo.upsert({ symbol: "BTC", priceJpy: "0.123456789012345678" });
    const [record] = await repo.findMany();
    expect(record.priceJpy.toString()).toBe("0.123456789012345678");
  });

  it("deleteで指定したidの行のみ削除される", async () => {
    const repo = await setup("test-delete.db");
    await repo.upsert({ symbol: "BTC", priceJpy: "100" });
    await repo.upsert({ symbol: "ETH", priceJpy: "50" });
    const [first, second] = await repo.findMany();
    await repo.delete(first.id);
    const remaining = await repo.findMany();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
  });
});
