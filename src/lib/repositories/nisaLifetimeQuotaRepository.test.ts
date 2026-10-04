/**
 * フェーズ2-25: `createClientNisaLifetimeQuotaRepository`
 * (wa-sqlite実装)が`NisaLifetimeQuotaRepository`インターフェースを、
 * Prisma実装(`createPrismaNisaLifetimeQuotaRepository`)と
 * 同じ挙動で満たすことを検証する。
 */
import { Decimal } from "decimal.js";
import { afterEach, describe, expect, it } from "vitest";
import { applyClientDbSchema } from "../clientDb/schema";
import { openClientDb, type ClientDb } from "../clientDb/sqlite";
import { createClientNisaLifetimeQuotaRepository } from "./nisaLifetimeQuotaRepository";

describe("createClientNisaLifetimeQuotaRepository", () => {
  const openDbs: ClientDb[] = [];

  async function setup(name: string) {
    const db = await openClientDb(name);
    openDbs.push(db);
    await applyClientDbSchema(db);
    return createClientNisaLifetimeQuotaRepository(db);
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

  it("upsertで登録した内容をfindByTaxYearIdで取得できる", async () => {
    const repo = await setup("test-upsert.db");
    await repo.upsert({
      taxYearId: 1,
      nisaType: "TSUMITATE",
      openingUsedJpy: "300000",
      soldCostBasisJpy: "50000",
    });
    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(1);
    expect(records[0].taxYearId).toBe(1);
    expect(records[0].nisaType).toBe("TSUMITATE");
    expect(records[0].openingUsedJpy).toBeInstanceOf(Decimal);
    expect(records[0].openingUsedJpy.toString()).toBe("300000");
    expect(records[0].soldCostBasisJpy.toString()).toBe("50000");
    expect(records[0].id).toBeTypeOf("number");
    expect(records[0].createdAt).toBeInstanceOf(Date);
    expect(records[0].updatedAt).toBeInstanceOf(Date);
  });

  it("同じtaxYearId・nisaTypeで2回upsertしても1件のみ保持され、値が更新される(upsert相当)", async () => {
    const repo = await setup("test-idempotent.db");
    await repo.upsert({
      taxYearId: 1,
      nisaType: "GROWTH",
      openingUsedJpy: "1000000",
      soldCostBasisJpy: "0",
    });
    await repo.upsert({
      taxYearId: 1,
      nisaType: "GROWTH",
      openingUsedJpy: "1200000",
      soldCostBasisJpy: "100000",
    });
    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(1);
    expect(records[0].openingUsedJpy.toString()).toBe("1200000");
    expect(records[0].soldCostBasisJpy.toString()).toBe("100000");
  });

  it("nisaTypeが異なれば同じtaxYearIdでも複数件保持される", async () => {
    const repo = await setup("test-multi-type.db");
    await repo.upsert({
      taxYearId: 1,
      nisaType: "GROWTH",
      openingUsedJpy: "500000",
      soldCostBasisJpy: "0",
    });
    await repo.upsert({
      taxYearId: 1,
      nisaType: "TSUMITATE",
      openingUsedJpy: "200000",
      soldCostBasisJpy: "0",
    });
    const records = await repo.findByTaxYearId(1);
    expect(records.map((r) => r.nisaType).sort()).toEqual(["GROWTH", "TSUMITATE"]);
  });

  it("高精度な小数値を桁落ちなく往復できる(フェーズ0-3のDecimalCodec方式)", async () => {
    const repo = await setup("test-precision.db");
    await repo.upsert({
      taxYearId: 1,
      nisaType: "TSUMITATE",
      openingUsedJpy: "0.123456789012345678",
      soldCostBasisJpy: "1000000.000000000001",
    });
    const records = await repo.findByTaxYearId(1);
    expect(records[0].openingUsedJpy.toString()).toBe("0.123456789012345678");
    expect(records[0].soldCostBasisJpy.toString()).toBe("1000000.000000000001");
  });

  it("deleteで指定したidの行のみ削除される", async () => {
    const repo = await setup("test-delete.db");
    await repo.upsert({
      taxYearId: 1,
      nisaType: "GROWTH",
      openingUsedJpy: "100000",
      soldCostBasisJpy: "0",
    });
    await repo.upsert({
      taxYearId: 1,
      nisaType: "TSUMITATE",
      openingUsedJpy: "200000",
      soldCostBasisJpy: "0",
    });
    const [first, second] = await repo.findByTaxYearId(1);
    await repo.delete(first.id);
    const remaining = await repo.findByTaxYearId(1);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
  });

  it("createManyで複数件を一括登録でき、soldCostBasisJpyは既定値0になる", async () => {
    const repo = await setup("test-create-many.db");
    await repo.createMany([
      { taxYearId: 1, nisaType: "TSUMITATE", openingUsedJpy: "10000" },
      { taxYearId: 1, nisaType: "GROWTH", openingUsedJpy: "20000" },
    ]);
    const records = await repo.findByTaxYearId(1);
    expect(records.map((r) => r.nisaType).sort()).toEqual(["GROWTH", "TSUMITATE"]);
    for (const record of records) {
      expect(record.soldCostBasisJpy.toString()).toBe("0");
    }
  });

  it("createManyは空配列を渡しても例外を投げない", async () => {
    const repo = await setup("test-create-many-empty.db");
    await expect(repo.createMany([])).resolves.toBeUndefined();
    expect(await repo.findByTaxYearId(1)).toEqual([]);
  });
});
