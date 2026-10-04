/**
 * フェーズ2-27: `createClientOpeningBalanceRepository`(wa-sqlite実装)が
 * `OpeningBalanceRepository`インターフェースを、Prisma実装
 * (`createPrismaOpeningBalanceRepository`)と同じ挙動で満たすことを検証する。
 * 真偽値列(isNisa/isListed)のクライアントDB変換(`booleanCodec.ts`)を
 * 検証する初めてのリポジトリテストでもある。
 */
import { Decimal } from "decimal.js";
import { afterEach, describe, expect, it } from "vitest";
import { applyClientDbSchema } from "../clientDb/schema";
import { openClientDb, type ClientDb } from "../clientDb/sqlite";
import { createClientOpeningBalanceRepository } from "./openingBalanceRepository";

describe("createClientOpeningBalanceRepository", () => {
  const openDbs: ClientDb[] = [];

  async function setup(name: string) {
    const db = await openClientDb(name);
    openDbs.push(db);
    await applyClientDbSchema(db);
    return createClientOpeningBalanceRepository(db);
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

  it("upsertで登録した内容をfindByTaxYearIdで取得でき、真偽値列も正しく復元される", async () => {
    const repo = await setup("test-upsert.db");
    await repo.upsert({
      taxYearId: 1,
      assetClass: "INVESTMENT",
      symbol: "1234",
      isNisa: true,
      isListed: false,
      quantity: "100",
      costBasisJpy: "500000",
    });
    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(1);
    expect(records[0].taxYearId).toBe(1);
    expect(records[0].assetClass).toBe("INVESTMENT");
    expect(records[0].symbol).toBe("1234");
    expect(records[0].isNisa).toBe(true);
    expect(records[0].isListed).toBe(false);
    expect(records[0].quantity).toBeInstanceOf(Decimal);
    expect(records[0].quantity.toString()).toBe("100");
    expect(records[0].costBasisJpy.toString()).toBe("500000");
    expect(records[0].id).toBeTypeOf("number");
    expect(records[0].createdAt).toBeInstanceOf(Date);
    expect(records[0].updatedAt).toBeInstanceOf(Date);
  });

  it("falseのisNisa/isListedも正しく復元される", async () => {
    const repo = await setup("test-upsert-false.db");
    await repo.upsert({
      taxYearId: 1,
      assetClass: "CRYPTO",
      symbol: "BTC",
      isNisa: false,
      isListed: true,
      quantity: "1.5",
      costBasisJpy: "3000000",
    });
    const [record] = await repo.findByTaxYearId(1);
    expect(record.isNisa).toBe(false);
    expect(record.isListed).toBe(true);
  });

  it("同じ複合キーで2回upsertしても1件のみ保持され、値が更新される(upsert相当)", async () => {
    const repo = await setup("test-idempotent.db");
    await repo.upsert({
      taxYearId: 1,
      assetClass: "INVESTMENT",
      symbol: "1234",
      isNisa: false,
      isListed: true,
      quantity: "100",
      costBasisJpy: "500000",
    });
    await repo.upsert({
      taxYearId: 1,
      assetClass: "INVESTMENT",
      symbol: "1234",
      isNisa: false,
      isListed: true,
      quantity: "150",
      costBasisJpy: "750000",
    });
    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(1);
    expect(records[0].quantity.toString()).toBe("150");
    expect(records[0].costBasisJpy.toString()).toBe("750000");
  });

  it("isNisa・isListedが異なれば同一銘柄でも別レコードとして保持される(複合ユニークキー)", async () => {
    const repo = await setup("test-composite-key.db");
    await repo.upsert({
      taxYearId: 1,
      assetClass: "INVESTMENT",
      symbol: "1234",
      isNisa: false,
      isListed: true,
      quantity: "100",
      costBasisJpy: "500000",
    });
    await repo.upsert({
      taxYearId: 1,
      assetClass: "INVESTMENT",
      symbol: "1234",
      isNisa: true,
      isListed: true,
      quantity: "200",
      costBasisJpy: "900000",
    });
    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.isNisa).sort()).toEqual([false, true]);
  });

  it("高精度な小数値を桁落ちなく往復できる(フェーズ0-3のDecimalCodec方式)", async () => {
    const repo = await setup("test-precision.db");
    await repo.upsert({
      taxYearId: 1,
      assetClass: "CRYPTO",
      symbol: "BTC",
      isNisa: false,
      isListed: true,
      quantity: "0.123456789012345678",
      costBasisJpy: "1000000.000000000001",
    });
    const [record] = await repo.findByTaxYearId(1);
    expect(record.quantity.toString()).toBe("0.123456789012345678");
    expect(record.costBasisJpy.toString()).toBe("1000000.000000000001");
  });

  it("deleteで指定したidの行のみ削除される", async () => {
    const repo = await setup("test-delete.db");
    await repo.upsert({
      taxYearId: 1,
      assetClass: "CRYPTO",
      symbol: "BTC",
      isNisa: false,
      isListed: true,
      quantity: "1",
      costBasisJpy: "1000000",
    });
    await repo.upsert({
      taxYearId: 1,
      assetClass: "CRYPTO",
      symbol: "ETH",
      isNisa: false,
      isListed: true,
      quantity: "10",
      costBasisJpy: "2000000",
    });
    const [first, second] = await repo.findByTaxYearId(1);
    await repo.delete(first.id);
    const remaining = await repo.findByTaxYearId(1);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
  });

  it("createManyで複数件を一括登録できる", async () => {
    const repo = await setup("test-create-many.db");
    await repo.createMany([
      {
        taxYearId: 1,
        assetClass: "CRYPTO",
        symbol: "BTC",
        isNisa: false,
        isListed: true,
        quantity: "1",
        costBasisJpy: "1000000",
      },
      {
        taxYearId: 1,
        assetClass: "INVESTMENT",
        symbol: "1234",
        isNisa: true,
        isListed: true,
        quantity: "50",
        costBasisJpy: "250000",
      },
    ]);
    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(2);
    const btc = records.find((r) => r.symbol === "BTC");
    expect(btc?.isNisa).toBe(false);
    const investment = records.find((r) => r.symbol === "1234");
    expect(investment?.isNisa).toBe(true);
  });

  it("createManyは空配列を渡しても例外を投げない", async () => {
    const repo = await setup("test-create-many-empty.db");
    await expect(repo.createMany([])).resolves.toBeUndefined();
    expect(await repo.findByTaxYearId(1)).toEqual([]);
  });
});
