/**
 * フェーズ2-26: `createClientIncomeDeductionRepository`
 * (wa-sqlite実装)が`IncomeDeductionRepository`インターフェースを、
 * Prisma実装(`createPrismaIncomeDeductionRepository`)と
 * 同じ挙動で満たすことを検証する。
 */
import { Decimal } from "decimal.js";
import { afterEach, describe, expect, it } from "vitest";
import { applyClientDbSchema } from "../clientDb/schema";
import { openClientDb, type ClientDb } from "../clientDb/sqlite";
import { createClientIncomeDeductionRepository } from "./incomeDeductionRepository";

describe("createClientIncomeDeductionRepository", () => {
  const openDbs: ClientDb[] = [];

  async function setup(name: string) {
    const db = await openClientDb(name);
    openDbs.push(db);
    await applyClientDbSchema(db);
    return createClientIncomeDeductionRepository(db);
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
      type: "MEDICAL_EXPENSE",
      incomeTaxAmountJpy: "100000",
      residentTaxAmountJpy: "100000",
    });
    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(1);
    expect(records[0].taxYearId).toBe(1);
    expect(records[0].type).toBe("MEDICAL_EXPENSE");
    expect(records[0].incomeTaxAmountJpy).toBeInstanceOf(Decimal);
    expect(records[0].incomeTaxAmountJpy.toString()).toBe("100000");
    expect(records[0].residentTaxAmountJpy.toString()).toBe("100000");
    expect(records[0].id).toBeTypeOf("number");
    expect(records[0].createdAt).toBeInstanceOf(Date);
    expect(records[0].updatedAt).toBeInstanceOf(Date);
  });

  it("同じtaxYearId・typeで2回upsertしても1件のみ保持され、値が更新される(upsert相当)", async () => {
    const repo = await setup("test-idempotent.db");
    await repo.upsert({
      taxYearId: 1,
      type: "LIFE_INSURANCE",
      incomeTaxAmountJpy: "40000",
      residentTaxAmountJpy: "28000",
    });
    await repo.upsert({
      taxYearId: 1,
      type: "LIFE_INSURANCE",
      incomeTaxAmountJpy: "50000",
      residentTaxAmountJpy: "35000",
    });
    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(1);
    expect(records[0].incomeTaxAmountJpy.toString()).toBe("50000");
    expect(records[0].residentTaxAmountJpy.toString()).toBe("35000");
  });

  it("typeが異なれば同じtaxYearIdでも複数件保持される", async () => {
    const repo = await setup("test-multi-type.db");
    await repo.upsert({
      taxYearId: 1,
      type: "MEDICAL_EXPENSE",
      incomeTaxAmountJpy: "100000",
      residentTaxAmountJpy: "100000",
    });
    await repo.upsert({
      taxYearId: 1,
      type: "SOCIAL_INSURANCE",
      incomeTaxAmountJpy: "300000",
      residentTaxAmountJpy: "300000",
    });
    const records = await repo.findByTaxYearId(1);
    expect(records.map((r) => r.type).sort()).toEqual(["MEDICAL_EXPENSE", "SOCIAL_INSURANCE"]);
  });

  it("高精度な小数値を桁落ちなく往復できる(フェーズ0-3のDecimalCodec方式)", async () => {
    const repo = await setup("test-precision.db");
    await repo.upsert({
      taxYearId: 1,
      type: "MEDICAL_EXPENSE",
      incomeTaxAmountJpy: "0.123456789012345678",
      residentTaxAmountJpy: "1000000.000000000001",
    });
    const records = await repo.findByTaxYearId(1);
    expect(records[0].incomeTaxAmountJpy.toString()).toBe("0.123456789012345678");
    expect(records[0].residentTaxAmountJpy.toString()).toBe("1000000.000000000001");
  });

  it("deleteByTaxYearIdAndTypeは指定したtaxYearId・typeの行のみ削除する", async () => {
    const repo = await setup("test-delete.db");
    await repo.upsert({
      taxYearId: 1,
      type: "MEDICAL_EXPENSE",
      incomeTaxAmountJpy: "100000",
      residentTaxAmountJpy: "100000",
    });
    await repo.upsert({
      taxYearId: 1,
      type: "SOCIAL_INSURANCE",
      incomeTaxAmountJpy: "300000",
      residentTaxAmountJpy: "300000",
    });
    await repo.deleteByTaxYearIdAndType(1, "MEDICAL_EXPENSE");
    const remaining = await repo.findByTaxYearId(1);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].type).toBe("SOCIAL_INSURANCE");
  });

  it("deleteByTaxYearIdAndTypeは未登録の組み合わせを指定しても例外を投げない", async () => {
    const repo = await setup("test-delete-missing.db");
    await expect(repo.deleteByTaxYearIdAndType(1, "MEDICAL_EXPENSE")).resolves.toBeUndefined();
  });
});
