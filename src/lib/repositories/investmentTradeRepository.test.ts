/**
 * フェーズ2-39: `createClientInvestmentTradeRepository`
 * (wa-sqlite実装)が`InvestmentTradeRepository`インターフェースを、
 * Prisma実装(`createPrismaInvestmentTradeRepository`)と
 * 同じ挙動で満たすことを検証する。
 */
import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { applyClientDbSchema } from "../clientDb/schema";
import { openClientDb, type ClientDb } from "../clientDb/sqlite";
import { createClientInvestmentTradeRepository } from "./investmentTradeRepository";

describe("createClientInvestmentTradeRepository", () => {
  const openDbs: ClientDb[] = [];

  async function setup(name: string) {
    const db = await openClientDb(name);
    openDbs.push(db);
    await applyClientDbSchema(db);
    return createClientInvestmentTradeRepository(db);
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
      symbol: "VTI",
      name: "バンガード・トータル・ストック・マーケットETF",
      assetType: "ETF",
      isReit: false,
      mutualFundHighForeignRatio: false,
      mutualFundVeryHighForeignRatio: false,
      isListed: true,
      type: "DIVIDEND",
      quantity: "10",
      unitPriceJpy: "0.123456789012345678",
      feeJpy: "100",
      accountType: "GENERAL",
      isNisa: false,
      isForeign: true,
      foreignTaxWithheldJpy: "50",
      distributionAdjustedForeignTaxJpy: "20",
      broker: "SBI証券",
      memo: "配当金",
    });
    expect(created.id).toBeTypeOf("number");
    expect(created.unitPriceJpy).toBeInstanceOf(Prisma.Decimal);
    expect(created.unitPriceJpy.toString()).toBe("0.123456789012345678");

    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(1);
    const record = records[0];
    expect(record.taxYearId).toBe(1);
    expect(record.symbol).toBe("VTI");
    expect(record.name).toBe("バンガード・トータル・ストック・マーケットETF");
    expect(record.assetType).toBe("ETF");
    expect(record.isReit).toBe(false);
    expect(record.isListed).toBe(true);
    expect(record.type).toBe("DIVIDEND");
    expect(record.quantity.toString()).toBe("10");
    expect(record.feeJpy.toString()).toBe("100");
    expect(record.accountType).toBe("GENERAL");
    expect(record.isNisa).toBe(false);
    expect(record.nisaType).toBeNull();
    expect(record.isForeign).toBe(true);
    expect(record.foreignTaxWithheldJpy.toString()).toBe("50");
    expect(record.distributionAdjustedForeignTaxJpy.toString()).toBe("20");
    expect(record.broker).toBe("SBI証券");
    expect(record.memo).toBe("配当金");
    expect(record.tradedAt.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(record.createdAt).toBeInstanceOf(Date);
    expect(record.updatedAt).toBeInstanceOf(Date);
  });

  it("省略可能な項目を省略した場合はPrisma側と同じデフォルト値が使われる", async () => {
    const repo = await setup("test-default.db");
    const created = await repo.create({
      taxYearId: 1,
      tradedAt: new Date("2026-01-01T00:00:00.000Z"),
      symbol: "7203",
      assetType: "STOCK",
      type: "BUY",
      quantity: "100",
      unitPriceJpy: "2500",
    });
    expect(created.name).toBeNull();
    expect(created.isReit).toBe(false);
    expect(created.mutualFundHighForeignRatio).toBe(false);
    expect(created.mutualFundVeryHighForeignRatio).toBe(false);
    expect(created.isListed).toBe(true);
    expect(created.feeJpy.toString()).toBe("0");
    expect(created.accountType).toBe("SPECIFIC_WITHHOLDING");
    expect(created.isNisa).toBe(false);
    expect(created.nisaType).toBeNull();
    expect(created.isForeign).toBe(false);
    expect(created.foreignTaxWithheldJpy.toString()).toBe("0");
    expect(created.distributionAdjustedForeignTaxJpy.toString()).toBe("0");
    expect(created.source).toBe("manual");
    expect(created.importBatchId).toBeNull();
  });

  it("NISA区分(nisaType)を指定して登録・取得できる", async () => {
    const repo = await setup("test-nisa-type.db");
    const created = await repo.create({
      taxYearId: 1,
      tradedAt: new Date("2026-01-01T00:00:00.000Z"),
      symbol: "8306",
      assetType: "STOCK",
      type: "BUY",
      quantity: "100",
      unitPriceJpy: "1000",
      isNisa: true,
      nisaType: "GROWTH",
    });
    expect(created.isNisa).toBe(true);
    expect(created.nisaType).toBe("GROWTH");
  });

  it("deleteで指定したidの行のみ削除される", async () => {
    const repo = await setup("test-delete.db");
    const first = await repo.create({
      taxYearId: 1,
      tradedAt: new Date("2026-01-01T00:00:00.000Z"),
      symbol: "7203",
      assetType: "STOCK",
      type: "BUY",
      quantity: "100",
      unitPriceJpy: "2500",
    });
    const second = await repo.create({
      taxYearId: 1,
      tradedAt: new Date("2026-02-01T00:00:00.000Z"),
      symbol: "9984",
      assetType: "STOCK",
      type: "BUY",
      quantity: "50",
      unitPriceJpy: "7000",
    });
    await repo.delete(first.id);
    const remaining = await repo.findByTaxYearId(1);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
  });
});
