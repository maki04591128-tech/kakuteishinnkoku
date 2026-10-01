/**
 * フェーズ2-28: `createClientOpeningBalanceByInstitutionRepository`
 * (wa-sqlite実装)が`OpeningBalanceByInstitutionRepository`インターフェースを、
 * Prisma実装(`createPrismaOpeningBalanceByInstitutionRepository`)と
 * 同じ挙動で満たすことを検証する。
 */
import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { applyClientDbSchema } from "../clientDb/schema";
import { openClientDb, type ClientDb } from "../clientDb/sqlite";
import { createClientOpeningBalanceByInstitutionRepository } from "./openingBalanceByInstitutionRepository";

describe("createClientOpeningBalanceByInstitutionRepository", () => {
  const openDbs: ClientDb[] = [];

  async function setup(name: string) {
    const db = await openClientDb(name);
    openDbs.push(db);
    await applyClientDbSchema(db);
    return createClientOpeningBalanceByInstitutionRepository(db);
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
      assetClass: "CRYPTO",
      symbol: "BTC",
      institution: "bitFlyer",
      quantity: "1.5",
    });
    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(1);
    expect(records[0].taxYearId).toBe(1);
    expect(records[0].assetClass).toBe("CRYPTO");
    expect(records[0].symbol).toBe("BTC");
    expect(records[0].institution).toBe("bitFlyer");
    expect(records[0].quantity).toBeInstanceOf(Prisma.Decimal);
    expect(records[0].quantity.toString()).toBe("1.5");
    expect(records[0].id).toBeTypeOf("number");
    expect(records[0].createdAt).toBeInstanceOf(Date);
    expect(records[0].updatedAt).toBeInstanceOf(Date);
  });

  it("同じ複合キーで2回upsertしても1件のみ保持され、値が更新される(upsert相当)", async () => {
    const repo = await setup("test-idempotent.db");
    await repo.upsert({
      taxYearId: 1,
      assetClass: "CRYPTO",
      symbol: "BTC",
      institution: "bitFlyer",
      quantity: "1",
    });
    await repo.upsert({
      taxYearId: 1,
      assetClass: "CRYPTO",
      symbol: "BTC",
      institution: "bitFlyer",
      quantity: "2.5",
    });
    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(1);
    expect(records[0].quantity.toString()).toBe("2.5");
  });

  it("institutionが異なれば同一銘柄でも別レコードとして保持される(複合ユニークキー)", async () => {
    const repo = await setup("test-composite-key.db");
    await repo.upsert({
      taxYearId: 1,
      assetClass: "CRYPTO",
      symbol: "BTC",
      institution: "bitFlyer",
      quantity: "1",
    });
    await repo.upsert({
      taxYearId: 1,
      assetClass: "CRYPTO",
      symbol: "BTC",
      institution: "Coincheck",
      quantity: "2",
    });
    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.institution).sort()).toEqual([
      "Coincheck",
      "bitFlyer",
    ]);
  });

  it("高精度な小数値を桁落ちなく往復できる(フェーズ0-3のDecimalCodec方式)", async () => {
    const repo = await setup("test-precision.db");
    await repo.upsert({
      taxYearId: 1,
      assetClass: "CRYPTO",
      symbol: "BTC",
      institution: "bitFlyer",
      quantity: "0.123456789012345678",
    });
    const [record] = await repo.findByTaxYearId(1);
    expect(record.quantity.toString()).toBe("0.123456789012345678");
  });

  it("deleteで指定したidの行のみ削除される", async () => {
    const repo = await setup("test-delete.db");
    await repo.upsert({
      taxYearId: 1,
      assetClass: "CRYPTO",
      symbol: "BTC",
      institution: "bitFlyer",
      quantity: "1",
    });
    await repo.upsert({
      taxYearId: 1,
      assetClass: "CRYPTO",
      symbol: "ETH",
      institution: "bitFlyer",
      quantity: "10",
    });
    const [first, second] = await repo.findByTaxYearId(1);
    await repo.delete(first.id);
    const remaining = await repo.findByTaxYearId(1);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
  });
});
