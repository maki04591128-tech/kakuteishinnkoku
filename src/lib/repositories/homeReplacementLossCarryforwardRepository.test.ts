/**
 * フェーズ2-19: `createClientHomeReplacementLossCarryforwardRepository`
 * (wa-sqlite実装)が`HomeReplacementLossCarryforwardRepository`
 * インターフェースを、Prisma実装
 * (`createPrismaHomeReplacementLossCarryforwardRepository`)と
 * 同じ挙動で満たすことを検証する。
 */
import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { applyClientDbSchema } from "../clientDb/schema";
import { openClientDb, type ClientDb } from "../clientDb/sqlite";
import { createClientHomeReplacementLossCarryforwardRepository } from "./homeReplacementLossCarryforwardRepository";

describe("createClientHomeReplacementLossCarryforwardRepository", () => {
  const openDbs: ClientDb[] = [];

  async function setup(name: string) {
    const db = await openClientDb(name);
    openDbs.push(db);
    await applyClientDbSchema(db);
    return createClientHomeReplacementLossCarryforwardRepository(db);
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
    await repo.upsert({ taxYearId: 1, originYear: 2023, remainingAmountJpy: "150000" });
    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(1);
    expect(records[0].taxYearId).toBe(1);
    expect(records[0].originYear).toBe(2023);
    expect(records[0].remainingAmountJpy).toBeInstanceOf(Prisma.Decimal);
    expect(records[0].remainingAmountJpy.toString()).toBe("150000");
    expect(records[0].id).toBeTypeOf("number");
    expect(records[0].createdAt).toBeInstanceOf(Date);
    expect(records[0].updatedAt).toBeInstanceOf(Date);
  });

  it("同じtaxYearId・originYearで2回upsertしても1件のみ保持され、値が更新される(upsert相当)", async () => {
    const repo = await setup("test-idempotent.db");
    await repo.upsert({ taxYearId: 1, originYear: 2023, remainingAmountJpy: "150000" });
    await repo.upsert({ taxYearId: 1, originYear: 2023, remainingAmountJpy: "200000" });
    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(1);
    expect(records[0].remainingAmountJpy.toString()).toBe("200000");
  });

  it("originYearが異なれば同じtaxYearIdでも複数件保持され、origin_year昇順で返る", async () => {
    const repo = await setup("test-multi-year.db");
    await repo.upsert({ taxYearId: 1, originYear: 2024, remainingAmountJpy: "50000" });
    await repo.upsert({ taxYearId: 1, originYear: 2022, remainingAmountJpy: "30000" });
    const records = await repo.findByTaxYearId(1);
    expect(records.map((r) => r.originYear)).toEqual([2022, 2024]);
  });

  it("高精度な小数値を桁落ちなく往復できる(フェーズ0-3のDecimalCodec方式)", async () => {
    const repo = await setup("test-precision.db");
    await repo.upsert({
      taxYearId: 1,
      originYear: 2023,
      remainingAmountJpy: "0.123456789012345678",
    });
    const records = await repo.findByTaxYearId(1);
    expect(records[0].remainingAmountJpy.toString()).toBe("0.123456789012345678");
  });

  it("deleteで指定したidの行のみ削除される", async () => {
    const repo = await setup("test-delete.db");
    await repo.upsert({ taxYearId: 1, originYear: 2022, remainingAmountJpy: "10000" });
    await repo.upsert({ taxYearId: 1, originYear: 2023, remainingAmountJpy: "20000" });
    const [first, second] = await repo.findByTaxYearId(1);
    await repo.delete(first.id);
    const remaining = await repo.findByTaxYearId(1);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
  });

  it("createManyで複数件を一括登録できる", async () => {
    const repo = await setup("test-create-many.db");
    await repo.createMany([
      { taxYearId: 1, originYear: 2021, remainingAmountJpy: "10000" },
      { taxYearId: 1, originYear: 2022, remainingAmountJpy: "20000" },
    ]);
    const records = await repo.findByTaxYearId(1);
    expect(records.map((r) => r.originYear)).toEqual([2021, 2022]);
  });

  it("createManyは空配列を渡しても例外を投げない", async () => {
    const repo = await setup("test-create-many-empty.db");
    await expect(repo.createMany([])).resolves.toBeUndefined();
    expect(await repo.findByTaxYearId(1)).toEqual([]);
  });
});
