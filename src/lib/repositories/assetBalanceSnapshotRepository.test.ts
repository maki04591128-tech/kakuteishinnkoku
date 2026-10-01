/**
 * フェーズ2-32: `createClientAssetBalanceSnapshotRepository`
 * (wa-sqlite実装)が`AssetBalanceSnapshotRepository`インターフェースを、
 * Prisma実装(`createPrismaAssetBalanceSnapshotRepository`)と
 * 同じ挙動で満たすことを検証する。
 */
import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { applyClientDbSchema } from "../clientDb/schema";
import { openClientDb, type ClientDb } from "../clientDb/sqlite";
import { createClientAssetBalanceSnapshotRepository } from "./assetBalanceSnapshotRepository";

describe("createClientAssetBalanceSnapshotRepository", () => {
  const openDbs: ClientDb[] = [];

  async function setup(name: string) {
    const db = await openClientDb(name);
    openDbs.push(db);
    await applyClientDbSchema(db);
    return createClientAssetBalanceSnapshotRepository(db);
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

  it("importCsvBatchで登録した内容をfindByTaxYearIdで取得できる", async () => {
    const repo = await setup("test-import.db");
    await repo.importCsvBatch({
      taxYearId: 1,
      sourceType: "moneyforward_assets",
      fileName: "assets.csv",
      rows: [
        {
          snapshotDate: new Date("2026-01-01T00:00:00.000Z"),
          category: "暗号資産",
          institution: "bitFlyer",
          assetName: "ビットコイン",
          balanceJpy: "1234567",
          quantity: "0.123456789012345678",
        },
        {
          snapshotDate: null,
          category: "",
          institution: "SBI証券",
          assetName: "楽天・全世界株式インデックス・ファンド",
          balanceJpy: "500000",
          quantity: null,
        },
      ],
    });

    const records = await repo.findByTaxYearId(1);
    expect(records).toHaveLength(2);

    const bitflyer = records.find((r) => r.institution === "bitFlyer");
    expect(bitflyer?.taxYearId).toBe(1);
    expect(bitflyer?.category).toBe("暗号資産");
    expect(bitflyer?.assetName).toBe("ビットコイン");
    expect(bitflyer?.balanceJpy).toBeInstanceOf(Prisma.Decimal);
    expect(bitflyer?.balanceJpy.toString()).toBe("1234567");
    expect(bitflyer?.quantity).toBeInstanceOf(Prisma.Decimal);
    expect(bitflyer?.quantity?.toString()).toBe("0.123456789012345678");
    expect(bitflyer?.snapshotDate.toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(bitflyer?.importBatchId).toBeTypeOf("number");
    expect(bitflyer?.createdAt).toBeInstanceOf(Date);

    const sbi = records.find((r) => r.institution === "SBI証券");
    expect(sbi?.quantity).toBeNull();
    expect(sbi?.category).toBe("");
  });

  it("findImportBatchesWithSnapshotsはsourceType・taxYearIdで絞り込み、importedAt降順で返す", async () => {
    const repo = await setup("test-find-batches.db");
    await repo.importCsvBatch({
      taxYearId: 1,
      sourceType: "moneyforward_assets",
      fileName: "first.csv",
      rows: [
        {
          snapshotDate: null,
          category: "",
          institution: "楽天証券",
          assetName: "資産A",
          balanceJpy: "100",
          quantity: null,
        },
      ],
    });
    await repo.importCsvBatch({
      taxYearId: 1,
      sourceType: "moneyforward_assets",
      fileName: "second.csv",
      rows: [
        {
          snapshotDate: null,
          category: "",
          institution: "SBI証券",
          assetName: "資産B",
          balanceJpy: "200",
          quantity: null,
        },
        {
          snapshotDate: null,
          category: "",
          institution: "bitFlyer",
          assetName: "資産C",
          balanceJpy: "300",
          quantity: null,
        },
      ],
    });
    await repo.importCsvBatch({
      taxYearId: 1,
      sourceType: "crypto_csv",
      fileName: "other-source.csv",
      rows: [
        {
          snapshotDate: null,
          category: "",
          institution: "bitFlyer",
          assetName: "資産D",
          balanceJpy: "400",
          quantity: null,
        },
      ],
    });

    const batches = await repo.findImportBatchesWithSnapshots({
      taxYearId: 1,
      sourceType: "moneyforward_assets",
    });
    expect(batches).toHaveLength(2);
    expect(batches[0].fileName).toBe("second.csv");
    expect(batches[0].rowCount).toBe(2);
    expect(batches[0].assetBalanceSnapshots.map((s) => s.institution)).toEqual(
      ["SBI証券", "bitFlyer"].sort(),
    );
    expect(batches[1].fileName).toBe("first.csv");
    expect(batches[1].assetBalanceSnapshots).toHaveLength(1);
  });

  it("deleteImportBatchでインポートバッチと紐づくスナップショットが両方削除される", async () => {
    const repo = await setup("test-delete.db");
    await repo.importCsvBatch({
      taxYearId: 1,
      sourceType: "moneyforward_assets",
      fileName: "assets.csv",
      rows: [
        {
          snapshotDate: null,
          category: "",
          institution: "bitFlyer",
          assetName: "ビットコイン",
          balanceJpy: "1000",
          quantity: "1",
        },
      ],
    });
    const [batch] = await repo.findImportBatchesWithSnapshots({
      taxYearId: 1,
      sourceType: "moneyforward_assets",
    });

    await repo.deleteImportBatch(batch.id);

    expect(await repo.findByTaxYearId(1)).toEqual([]);
    expect(
      await repo.findImportBatchesWithSnapshots({
        taxYearId: 1,
        sourceType: "moneyforward_assets",
      }),
    ).toEqual([]);
  });
});
