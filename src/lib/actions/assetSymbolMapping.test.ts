import { describe, expect, it, vi } from "vitest";
import type { AssetSymbolMappingRepository } from "@/lib/repositories/assetSymbolMappingRepository";
import { deleteAssetSymbolMappingCore, setAssetSymbolMappingCore } from "./assetSymbolMapping";

function createFakeAssetSymbolMappingRepository(): AssetSymbolMappingRepository {
  return {
    findMany: vi.fn(async () => []),
    upsert: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
  };
}

describe("setAssetSymbolMappingCore", () => {
  it("銘柄名・ティッカーを前後空白除去・大文字化してupsertし、importページへの遷移先を返す", async () => {
    const repo = createFakeAssetSymbolMappingRepository();

    const result = await setAssetSymbolMappingCore(repo, {
      year: 2025,
      assetName: "  楽天・全世界株式インデックス・ファンド  ",
      symbol: "  orei  ",
    });

    expect(repo.upsert).toHaveBeenCalledWith({
      assetName: "楽天・全世界株式インデックス・ファンド",
      symbol: "OREI",
    });
    expect(result).toEqual({ redirectTo: "/import?year=2025&tab=assetBalance" });
  });
});

describe("deleteAssetSymbolMappingCore", () => {
  it("指定IDを削除し、importページへの遷移先を返す", async () => {
    const repo = createFakeAssetSymbolMappingRepository();

    const result = await deleteAssetSymbolMappingCore(repo, { id: 7, year: 2024 });

    expect(repo.delete).toHaveBeenCalledWith(7);
    expect(result).toEqual({ redirectTo: "/import?year=2024&tab=assetBalance" });
  });
});
