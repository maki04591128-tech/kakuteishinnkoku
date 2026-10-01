/**
 * フェーズ2-31: `createClientBrokerAnnualReportRepository`
 * (wa-sqlite実装)が`BrokerAnnualReportRepository`インターフェースを、
 * Prisma実装(`createPrismaBrokerAnnualReportRepository`)と
 * 同じ挙動で満たすことを検証する。
 */
import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { applyClientDbSchema } from "../clientDb/schema";
import { openClientDb, type ClientDb } from "../clientDb/sqlite";
import { createClientBrokerAnnualReportRepository } from "./brokerAnnualReportRepository";

describe("createClientBrokerAnnualReportRepository", () => {
  const openDbs: ClientDb[] = [];

  async function setup(name: string) {
    const db = await openClientDb(name);
    openDbs.push(db);
    await applyClientDbSchema(db);
    return createClientBrokerAnnualReportRepository(db);
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
      broker: "SBI証券",
      accountType: "SPECIFIC_WITHHOLDING",
      proceedsJpy: "1000000",
      acquisitionCostJpy: "800000",
      dividendJpy: "5000",
    });
    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(1);
    expect(records[0].taxYearId).toBe(1);
    expect(records[0].broker).toBe("SBI証券");
    expect(records[0].accountType).toBe("SPECIFIC_WITHHOLDING");
    expect(records[0].proceedsJpy).toBeInstanceOf(Prisma.Decimal);
    expect(records[0].proceedsJpy.toString()).toBe("1000000");
    expect(records[0].acquisitionCostJpy.toString()).toBe("800000");
    expect(records[0].dividendJpy.toString()).toBe("5000");
    expect(records[0].memo).toBeNull();
    expect(records[0].id).toBeTypeOf("number");
    expect(records[0].createdAt).toBeInstanceOf(Date);
    expect(records[0].updatedAt).toBeInstanceOf(Date);
  });

  it("同じ複合キーで2回upsertしても1件のみ保持され、値が更新される(upsert相当)", async () => {
    const repo = await setup("test-idempotent.db");
    await repo.upsert({
      taxYearId: 1,
      broker: "SBI証券",
      accountType: "SPECIFIC_WITHHOLDING",
      proceedsJpy: "1000000",
      acquisitionCostJpy: "800000",
      dividendJpy: "5000",
    });
    await repo.upsert({
      taxYearId: 1,
      broker: "SBI証券",
      accountType: "SPECIFIC_WITHHOLDING",
      proceedsJpy: "2000000",
      acquisitionCostJpy: "1500000",
      dividendJpy: "10000",
    });
    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(1);
    expect(records[0].proceedsJpy.toString()).toBe("2000000");
    expect(records[0].acquisitionCostJpy.toString()).toBe("1500000");
    expect(records[0].dividendJpy.toString()).toBe("10000");
  });

  it("brokerまたはaccountTypeが異なれば別レコードとして保持される(複合ユニークキー)", async () => {
    const repo = await setup("test-composite-key.db");
    await repo.upsert({
      taxYearId: 1,
      broker: "SBI証券",
      accountType: "SPECIFIC_WITHHOLDING",
      proceedsJpy: "1000000",
      acquisitionCostJpy: "800000",
      dividendJpy: "5000",
    });
    await repo.upsert({
      taxYearId: 1,
      broker: "SBI証券",
      accountType: "SPECIFIC_NO_WITHHOLDING",
      proceedsJpy: "500000",
      acquisitionCostJpy: "400000",
      dividendJpy: "0",
    });
    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.accountType).sort()).toEqual([
      "SPECIFIC_NO_WITHHOLDING",
      "SPECIFIC_WITHHOLDING",
    ]);
  });

  it("高精度な小数値を桁落ちなく往復できる(フェーズ0-3のDecimalCodec方式)", async () => {
    const repo = await setup("test-precision.db");
    await repo.upsert({
      taxYearId: 1,
      broker: "SBI証券",
      accountType: "SPECIFIC_WITHHOLDING",
      proceedsJpy: "0.123456789012345678",
      acquisitionCostJpy: "0.1",
      dividendJpy: "0.01",
    });
    const [record] = await repo.findByTaxYearId(1);
    expect(record.proceedsJpy.toString()).toBe("0.123456789012345678");
  });

  it("deleteで指定したidの行のみ削除される", async () => {
    const repo = await setup("test-delete.db");
    await repo.upsert({
      taxYearId: 1,
      broker: "SBI証券",
      accountType: "SPECIFIC_WITHHOLDING",
      proceedsJpy: "1000000",
      acquisitionCostJpy: "800000",
      dividendJpy: "5000",
    });
    await repo.upsert({
      taxYearId: 1,
      broker: "楽天証券",
      accountType: "SPECIFIC_WITHHOLDING",
      proceedsJpy: "2000000",
      acquisitionCostJpy: "1500000",
      dividendJpy: "10000",
    });
    const [first, second] = await repo.findByTaxYearId(1);
    await repo.delete(first.id);
    const remaining = await repo.findByTaxYearId(1);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
  });

  it("upsertManyは複数件をまとめて登録・更新できる", async () => {
    const repo = await setup("test-upsert-many.db");
    await repo.upsertMany([
      {
        taxYearId: 1,
        broker: "SBI証券",
        accountType: "SPECIFIC_WITHHOLDING",
        proceedsJpy: "1000000",
        acquisitionCostJpy: "800000",
        dividendJpy: "5000",
      },
      {
        taxYearId: 1,
        broker: "楽天証券",
        accountType: "SPECIFIC_WITHHOLDING",
        proceedsJpy: "2000000",
        acquisitionCostJpy: "1500000",
        dividendJpy: "10000",
      },
    ]);
    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.broker).sort()).toEqual(
      ["SBI証券", "楽天証券"].sort(),
    );

    await repo.upsertMany([
      {
        taxYearId: 1,
        broker: "SBI証券",
        accountType: "SPECIFIC_WITHHOLDING",
        proceedsJpy: "3000000",
        acquisitionCostJpy: "2500000",
        dividendJpy: "20000",
      },
    ]);
    const updated = await repo.findByTaxYearId(1);
    expect(updated).toHaveLength(2);
    const sbi = updated.find((r) => r.broker === "SBI証券");
    expect(sbi?.proceedsJpy.toString()).toBe("3000000");
  });
});
