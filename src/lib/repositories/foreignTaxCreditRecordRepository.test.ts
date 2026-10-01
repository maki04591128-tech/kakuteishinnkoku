/**
 * フェーズ2-24: `createClientForeignTaxCreditRecordRepository`(wa-sqlite実装)が
 * `ForeignTaxCreditRecordRepository`インターフェースを、Prisma実装
 * (`createPrismaForeignTaxCreditRecordRepository`)と同じ挙動で満たすことを検証する。
 */
import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { applyClientDbSchema } from "../clientDb/schema";
import { openClientDb, type ClientDb } from "../clientDb/sqlite";
import { createClientForeignTaxCreditRecordRepository } from "./foreignTaxCreditRecordRepository";

describe("createClientForeignTaxCreditRecordRepository", () => {
  const openDbs: ClientDb[] = [];

  async function setup(name: string) {
    const db = await openClientDb(name);
    openDbs.push(db);
    await applyClientDbSchema(db);
    return createClientForeignTaxCreditRecordRepository(db);
  }

  afterEach(async () => {
    while (openDbs.length > 0) {
      await openDbs.pop()?.close();
    }
  });

  it("findByTaxYearIdは未登録のtaxYearIdに対してnullを返す", async () => {
    const repo = await setup("test-find-missing.db");
    expect(await repo.findByTaxYearId(1)).toBeNull();
  });

  it("upsertで登録した内容をfindByTaxYearIdで取得できる", async () => {
    const repo = await setup("test-upsert.db");
    await repo.upsert({
      taxYearId: 1,
      totalCreditJpy: "100000",
      nationalTaxCreditJpy: "70000",
      residentTaxCreditJpy: "30000",
    });
    const record = await repo.findByTaxYearId(1);
    expect(record).not.toBeNull();
    expect(record?.taxYearId).toBe(1);
    expect(record?.totalCreditJpy).toBeInstanceOf(Prisma.Decimal);
    expect(record?.totalCreditJpy.toString()).toBe("100000");
    expect(record?.nationalTaxCreditJpy).toBeInstanceOf(Prisma.Decimal);
    expect(record?.nationalTaxCreditJpy.toString()).toBe("70000");
    expect(record?.residentTaxCreditJpy).toBeInstanceOf(Prisma.Decimal);
    expect(record?.residentTaxCreditJpy.toString()).toBe("30000");
    expect(record?.id).toBeTypeOf("number");
    expect(record?.createdAt).toBeInstanceOf(Date);
    expect(record?.updatedAt).toBeInstanceOf(Date);
  });

  it("同じtaxYearIdで2回upsertしても1件のみ保持され、値が更新される(upsert相当)", async () => {
    const repo = await setup("test-idempotent.db");
    await repo.upsert({
      taxYearId: 1,
      totalCreditJpy: "100000",
      nationalTaxCreditJpy: "70000",
      residentTaxCreditJpy: "30000",
    });
    await repo.upsert({
      taxYearId: 1,
      totalCreditJpy: "200000",
      nationalTaxCreditJpy: "150000",
      residentTaxCreditJpy: "50000",
    });
    const record = await repo.findByTaxYearId(1);
    expect(record?.totalCreditJpy.toString()).toBe("200000");
    expect(record?.nationalTaxCreditJpy.toString()).toBe("150000");
    expect(record?.residentTaxCreditJpy.toString()).toBe("50000");
  });

  it("高精度な小数値を桁落ちなく往復できる(フェーズ0-3のDecimalCodec方式)", async () => {
    const repo = await setup("test-precision.db");
    await repo.upsert({
      taxYearId: 1,
      totalCreditJpy: "0.123456789012345678",
      nationalTaxCreditJpy: "0.111111111111111111",
      residentTaxCreditJpy: "0.012345678901234567",
    });
    const record = await repo.findByTaxYearId(1);
    expect(record?.totalCreditJpy.toString()).toBe("0.123456789012345678");
    expect(record?.nationalTaxCreditJpy.toString()).toBe("0.111111111111111111");
    expect(record?.residentTaxCreditJpy.toString()).toBe("0.012345678901234567");
  });

  it("deleteByTaxYearIdで登録済みの行が削除される", async () => {
    const repo = await setup("test-delete.db");
    await repo.upsert({
      taxYearId: 1,
      totalCreditJpy: "100000",
      nationalTaxCreditJpy: "70000",
      residentTaxCreditJpy: "30000",
    });
    await repo.deleteByTaxYearId(1);
    expect(await repo.findByTaxYearId(1)).toBeNull();
  });

  it("deleteByTaxYearIdは未登録のtaxYearIdに対しても例外を投げない", async () => {
    const repo = await setup("test-delete-missing.db");
    await expect(repo.deleteByTaxYearId(999)).resolves.toBeUndefined();
  });
});
