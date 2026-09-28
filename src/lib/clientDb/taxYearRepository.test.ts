import { describe, expect, it } from "vitest";
import {
  createTaxYearClientDb,
  getOrCreateTaxYear,
  listTaxYears,
} from "./taxYearRepository";

describe("clientDb PoC(wa-sqlite)のTaxYear CRUD", () => {
  it("同じ年で2回呼んでも1件のみ保持される(upsert相当)", async () => {
    const db = await createTaxYearClientDb("test-idempotent.db");
    try {
      await getOrCreateTaxYear(db, 2025);
      await getOrCreateTaxYear(db, 2025);
      expect(await listTaxYears(db)).toEqual([2025]);
    } finally {
      await db.close();
    }
  });

  it("登録した年を新しい順に取得できる", async () => {
    const db = await createTaxYearClientDb("test-order.db");
    try {
      await getOrCreateTaxYear(db, 2023);
      await getOrCreateTaxYear(db, 2025);
      await getOrCreateTaxYear(db, 2024);
      expect(await listTaxYears(db)).toEqual([2025, 2024, 2023]);
    } finally {
      await db.close();
    }
  });

  it("既定のcrypto_cost_methodはAVERAGE(Prismaスキーマのデフォルトと一致)", async () => {
    const db = await createTaxYearClientDb("test-default.db");
    try {
      const created = await getOrCreateTaxYear(db, 2025);
      expect(created.crypto_cost_method).toBe("AVERAGE");
    } finally {
      await db.close();
    }
  });
});
