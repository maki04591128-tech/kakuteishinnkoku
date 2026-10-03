/**
 * フェーズ2-3: `createClientEmploymentIncomeRecordRepository`(wa-sqlite実装)が
 * `EmploymentIncomeRecordRepository`インターフェースを、Prisma実装
 * (`createPrismaEmploymentIncomeRecordRepository`。`employmentIncomeRecordRepository.prisma.ts`)
 * と同じ挙動で満たすことを検証する。フェーズ5-1-3bで`grossSalaryJpy`の実体を
 * `@prisma/client`の`Prisma.Decimal`ではなく`decimal.js`の`Decimal`に変更したため
 * (スタンドアロン版バンドルに`@prisma/client`本体を引き込まないため)、
 * instanceofの確認も`decimal.js`側のクラスで行う。
 */
import { Decimal } from "decimal.js";
import { afterEach, describe, expect, it } from "vitest";
import { applyClientDbSchema } from "../clientDb/schema";
import { openClientDb, type ClientDb } from "../clientDb/sqlite";
import { createClientEmploymentIncomeRecordRepository } from "./employmentIncomeRecordRepository";

describe("createClientEmploymentIncomeRecordRepository", () => {
  const openDbs: ClientDb[] = [];

  async function setup(name: string) {
    const db = await openClientDb(name);
    openDbs.push(db);
    await applyClientDbSchema(db);
    return createClientEmploymentIncomeRecordRepository(db);
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
    await repo.upsert({ taxYearId: 1, grossSalaryJpy: "5000000" });
    const record = await repo.findByTaxYearId(1);
    expect(record).not.toBeNull();
    expect(record?.taxYearId).toBe(1);
    expect(record?.grossSalaryJpy).toBeInstanceOf(Decimal);
    expect(record?.grossSalaryJpy.toString()).toBe("5000000");
    expect(record?.id).toBeTypeOf("number");
    expect(record?.createdAt).toBeInstanceOf(Date);
    expect(record?.updatedAt).toBeInstanceOf(Date);
  });

  it("同じtaxYearIdで2回upsertしても1件のみ保持され、値が更新される(upsert相当)", async () => {
    const repo = await setup("test-idempotent.db");
    await repo.upsert({ taxYearId: 1, grossSalaryJpy: "5000000" });
    await repo.upsert({ taxYearId: 1, grossSalaryJpy: "6000000" });
    const record = await repo.findByTaxYearId(1);
    expect(record?.grossSalaryJpy.toString()).toBe("6000000");
  });

  it("高精度な小数値を桁落ちなく往復できる(フェーズ0-3のDecimalCodec方式)", async () => {
    const repo = await setup("test-precision.db");
    await repo.upsert({ taxYearId: 1, grossSalaryJpy: "0.123456789012345678" });
    const record = await repo.findByTaxYearId(1);
    expect(record?.grossSalaryJpy.toString()).toBe("0.123456789012345678");
  });

  it("deleteByTaxYearIdで登録済みの行が削除される", async () => {
    const repo = await setup("test-delete.db");
    await repo.upsert({ taxYearId: 1, grossSalaryJpy: "5000000" });
    await repo.deleteByTaxYearId(1);
    expect(await repo.findByTaxYearId(1)).toBeNull();
  });

  it("deleteByTaxYearIdは未登録のtaxYearIdに対しても例外を投げない", async () => {
    const repo = await setup("test-delete-missing.db");
    await expect(repo.deleteByTaxYearId(999)).resolves.toBeUndefined();
  });
});
