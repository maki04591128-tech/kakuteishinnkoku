import { describe, expect, it, vi } from "vitest";
import type { MarketPriceRepository } from "@/lib/repositories/marketPriceRepository";
import { deleteMarketPriceCore, setMarketPriceCore } from "./marketPrice";

function createFakeMarketPriceRepository(): MarketPriceRepository {
  return {
    findMany: vi.fn(async () => []),
    upsert: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
  };
}

describe("setMarketPriceCore", () => {
  it("シンボルを大文字化・前後空白除去してupsertし、importページへの遷移先を返す", async () => {
    const repo = createFakeMarketPriceRepository();

    const result = await setMarketPriceCore(repo, {
      year: 2025,
      symbol: "  btc  ",
      priceJpy: "  10000000  ",
    });

    expect(repo.upsert).toHaveBeenCalledWith({
      symbol: "BTC",
      priceJpy: "10000000",
    });
    expect(result).toEqual({ redirectTo: "/import?year=2025&tab=assetBalance" });
  });
});

describe("deleteMarketPriceCore", () => {
  it("指定IDを削除し、importページへの遷移先を返す", async () => {
    const repo = createFakeMarketPriceRepository();

    const result = await deleteMarketPriceCore(repo, { id: 9, year: 2024 });

    expect(repo.delete).toHaveBeenCalledWith(9);
    expect(result).toEqual({ redirectTo: "/import?year=2024&tab=assetBalance" });
  });
});
