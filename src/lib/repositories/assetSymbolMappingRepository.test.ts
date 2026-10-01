/**
 * フェーズ2-30: `createClientAssetSymbolMappingRepository`(wa-sqlite実装)が
 * `AssetSymbolMappingRepository`インターフェースを、Prisma実装
 * (`createPrismaAssetSymbolMappingRepository`)と同じ挙動で満たすことを検証する。
 */
import { afterEach, describe, expect, it } from "vitest";
import { applyClientDbSchema } from "../clientDb/schema";
import { openClientDb, type ClientDb } from "../clientDb/sqlite";
import { createClientAssetSymbolMappingRepository } from "./assetSymbolMappingRepository";

describe("createClientAssetSymbolMappingRepository", () => {
  const openDbs: ClientDb[] = [];

  async function setup(name: string) {
    const db = await openClientDb(name);
    openDbs.push(db);
    await applyClientDbSchema(db);
    return createClientAssetSymbolMappingRepository(db);
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
    await repo.upsert({ assetName: "ビットコイン", symbol: "BTC" });
    const records = await repo.findMany();
    expect(records).toHaveLength(1);
    expect(records[0].assetName).toBe("ビットコイン");
    expect(records[0].symbol).toBe("BTC");
    expect(records[0].id).toBeTypeOf("number");
    expect(records[0].createdAt).toBeInstanceOf(Date);
    expect(records[0].updatedAt).toBeInstanceOf(Date);
  });

  it("同じassetNameで2回upsertしても1件のみ保持され、symbolが更新される(upsert相当)", async () => {
    const repo = await setup("test-idempotent.db");
    await repo.upsert({ assetName: "ビットコイン", symbol: "BTC" });
    await repo.upsert({ assetName: "ビットコイン", symbol: "BTC2" });
    const records = await repo.findMany();
    expect(records).toHaveLength(1);
    expect(records[0].symbol).toBe("BTC2");
  });

  it("assetNameが異なれば別レコードとして保持され、assetName昇順で返る", async () => {
    const repo = await setup("test-unique.db");
    await repo.upsert({ assetName: "イーサリアム", symbol: "ETH" });
    await repo.upsert({ assetName: "ビットコイン", symbol: "BTC" });
    const records = await repo.findMany();
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.assetName)).toEqual(["イーサリアム", "ビットコイン"]);
  });

  it("deleteで指定したidの行のみ削除される", async () => {
    const repo = await setup("test-delete.db");
    await repo.upsert({ assetName: "イーサリアム", symbol: "ETH" });
    await repo.upsert({ assetName: "ビットコイン", symbol: "BTC" });
    const [first, second] = await repo.findMany();
    await repo.delete(first.id);
    const remaining = await repo.findMany();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
  });
});
