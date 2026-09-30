/**
 * フェーズ2-1: `createClientTaxYearRepository`(wa-sqlite実装)が
 * `TaxYearRepository`インターフェースを、Prisma実装(`createPrismaTaxYearRepository`)
 * と同じ挙動で満たすことを検証する。
 */
import { afterEach, describe, expect, it } from "vitest";
import { applyClientDbSchema } from "../clientDb/schema";
import { openClientDb, type ClientDb } from "../clientDb/sqlite";
import { createClientTaxYearRepository } from "./taxYearRepository";

describe("createClientTaxYearRepository", () => {
  const openDbs: ClientDb[] = [];

  async function setup(name: string) {
    const db = await openClientDb(name);
    openDbs.push(db);
    await applyClientDbSchema(db);
    return createClientTaxYearRepository(db);
  }

  afterEach(async () => {
    while (openDbs.length > 0) {
      await openDbs.pop()?.close();
    }
  });

  it("同じ年で2回呼んでも1件のみ保持される(upsert相当)", async () => {
    const repo = await setup("test-idempotent.db");
    await repo.getOrCreateTaxYear(2025);
    await repo.getOrCreateTaxYear(2025);
    expect(await repo.listTaxYears()).toEqual([2025]);
  });

  it("登録した年を新しい順に取得できる", async () => {
    const repo = await setup("test-order.db");
    await repo.getOrCreateTaxYear(2023);
    await repo.getOrCreateTaxYear(2025);
    await repo.getOrCreateTaxYear(2024);
    expect(await repo.listTaxYears()).toEqual([2025, 2024, 2023]);
  });

  it("既定のcryptoCostMethodはAVERAGE(Prismaスキーマのデフォルトと一致)", async () => {
    const repo = await setup("test-default.db");
    const created = await repo.getOrCreateTaxYear(2025);
    expect(created.cryptoCostMethod).toBe("AVERAGE");
    expect(created.id).toBeTypeOf("number");
    expect(created.createdAt).toBeInstanceOf(Date);
  });

  it("findByYearは未登録の年に対してnullを返す", async () => {
    const repo = await setup("test-find-missing.db");
    expect(await repo.findByYear(2025)).toBeNull();
  });

  it("findByYearは登録済みの年の行を返す", async () => {
    const repo = await setup("test-find.db");
    const created = await repo.getOrCreateTaxYear(2025);
    expect(await repo.findByYear(2025)).toEqual(created);
  });

  it("updateCryptoCostMethodでMOVING_AVERAGEに変更できる", async () => {
    const repo = await setup("test-update.db");
    const created = await repo.getOrCreateTaxYear(2025);
    await repo.updateCryptoCostMethod(created.id, "MOVING_AVERAGE");
    const updated = await repo.findByYear(2025);
    expect(updated?.cryptoCostMethod).toBe("MOVING_AVERAGE");
  });
});
