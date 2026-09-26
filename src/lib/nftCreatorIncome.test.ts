import { describe, expect, it } from "vitest";
import { estimateNftCreatorIncome } from "./nftCreatorIncome";

describe("estimateNftCreatorIncome", () => {
  it("1件のNFT一次流通の雑所得を計算する(制作費は必要経費に含めない)", () => {
    // 譲渡収入30万円-組成費用1万円-販売手数料2万円=27万円。制作費5万円は参考情報のみ。
    const result = estimateNftCreatorIncome({
      items: [
        {
          description: "デジタルアートA",
          transferRevenueJpy: 300_000,
          mintingCostJpy: 10_000,
          sellingAndAdminExpensesJpy: 20_000,
          artCreationCostJpy: 50_000,
        },
      ],
    });
    expect(result.totalRevenueJpy.toNumber()).toBe(300_000);
    expect(result.deductibleExpensesJpy.toNumber()).toBe(30_000);
    expect(result.excludedArtCreationCostJpy.toNumber()).toBe(50_000);
    expect(result.miscIncomeJpy.toNumber()).toBe(270_000);
  });

  it("複数件のNFT取引を合算する", () => {
    const result = estimateNftCreatorIncome({
      items: [
        {
          description: "作品1",
          transferRevenueJpy: 100_000,
          mintingCostJpy: 5_000,
          sellingAndAdminExpensesJpy: 5_000,
          artCreationCostJpy: 0,
        },
        {
          description: "作品2",
          transferRevenueJpy: 200_000,
          mintingCostJpy: 10_000,
          sellingAndAdminExpensesJpy: 10_000,
          artCreationCostJpy: 0,
        },
      ],
    });
    expect(result.totalRevenueJpy.toNumber()).toBe(300_000);
    expect(result.deductibleExpensesJpy.toNumber()).toBe(30_000);
    expect(result.miscIncomeJpy.toNumber()).toBe(270_000);
  });

  it("必要経費が譲渡収入を上回る場合は赤字(マイナス)をそのまま返す", () => {
    const result = estimateNftCreatorIncome({
      items: [
        {
          description: "不人気作品",
          transferRevenueJpy: 5_000,
          mintingCostJpy: 8_000,
          sellingAndAdminExpensesJpy: 2_000,
          artCreationCostJpy: 0,
        },
      ],
    });
    expect(result.miscIncomeJpy.toNumber()).toBe(-5_000);
  });

  it("負の入力値はエラーになる", () => {
    expect(() =>
      estimateNftCreatorIncome({
        items: [
          {
            description: "不正な入力",
            transferRevenueJpy: -1,
            mintingCostJpy: 0,
            sellingAndAdminExpensesJpy: 0,
            artCreationCostJpy: 0,
          },
        ],
      }),
    ).toThrow();
  });

  it("入力が0件の場合は全て0になる", () => {
    const result = estimateNftCreatorIncome({ items: [] });
    expect(result.totalRevenueJpy.toNumber()).toBe(0);
    expect(result.deductibleExpensesJpy.toNumber()).toBe(0);
    expect(result.miscIncomeJpy.toNumber()).toBe(0);
  });
});
