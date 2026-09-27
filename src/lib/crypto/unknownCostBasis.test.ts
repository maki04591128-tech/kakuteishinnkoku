import { describe, expect, it } from "vitest";
import {
  calculateCryptoEstimatedAcquisitionCostJpy,
  estimateCryptoIncomeWithUnknownCostBasis,
} from "./unknownCostBasis";

describe("calculateCryptoEstimatedAcquisitionCostJpy", () => {
  it("収入金額の5%相当額を返す", () => {
    expect(calculateCryptoEstimatedAcquisitionCostJpy(5_000_000).toNumber()).toBe(250_000);
  });

  it("収入金額が負の場合はエラーになる", () => {
    expect(() => calculateCryptoEstimatedAcquisitionCostJpy(-1)).toThrow();
  });
});

describe("estimateCryptoIncomeWithUnknownCostBasis", () => {
  it("取得費が不明な取引は収入金額の5%相当額を取得費として雑所得を計算する", () => {
    const result = estimateCryptoIncomeWithUnknownCostBasis({
      trades: [{ label: "取引所不明のBTC売却", proceedsJpy: 5_000_000 }],
    });

    const t = result.trades[0];
    expect(t.estimatedApplied).toBe(true);
    expect(t.actualAcquisitionCostJpy).toBeNull();
    expect(t.estimatedAcquisitionCostJpy.toNumber()).toBe(250_000);
    expect(t.acquisitionCostJpy.toNumber()).toBe(250_000);
    expect(t.miscellaneousIncomeJpy.toNumber()).toBe(4_750_000);
  });

  it("実際の取得費が判明している取引はその実額をそのまま採用する(5%とは比較しない)", () => {
    const result = estimateCryptoIncomeWithUnknownCostBasis({
      trades: [
        { label: "実額判明", proceedsJpy: 5_000_000, actualAcquisitionCostJpy: 100_000 },
      ],
    });

    const t = result.trades[0];
    expect(t.estimatedApplied).toBe(false);
    expect(t.actualAcquisitionCostJpy?.toNumber()).toBe(100_000);
    // 参考値としては常に5%相当額を計算する
    expect(t.estimatedAcquisitionCostJpy.toNumber()).toBe(250_000);
    // 実額(5%相当額を下回る)がそのまま採用される。土地・建物の特例と異なり
    // 「いずれか高い方」を自動選択する片方向の特例ではない。
    expect(t.acquisitionCostJpy.toNumber()).toBe(100_000);
    expect(t.miscellaneousIncomeJpy.toNumber()).toBe(4_900_000);
  });

  it("実額が5%相当額を上回っていてもその実額をそのまま採用する", () => {
    const result = estimateCryptoIncomeWithUnknownCostBasis({
      trades: [
        { label: "実額判明(高め)", proceedsJpy: 5_000_000, actualAcquisitionCostJpy: 4_000_000 },
      ],
    });

    const t = result.trades[0];
    expect(t.acquisitionCostJpy.toNumber()).toBe(4_000_000);
    expect(t.miscellaneousIncomeJpy.toNumber()).toBe(1_000_000);
  });

  it("複数取引を合算して合計値を計算する", () => {
    const result = estimateCryptoIncomeWithUnknownCostBasis({
      trades: [
        { label: "不明分", proceedsJpy: 1_000_000 },
        { label: "判明分", proceedsJpy: 2_000_000, actualAcquisitionCostJpy: 1_500_000 },
      ],
    });

    expect(result.totalProceedsJpy.toNumber()).toBe(3_000_000);
    // 不明分: 50,000円(5%) + 判明分: 1,500,000円
    expect(result.totalAcquisitionCostJpy.toNumber()).toBe(1_550_000);
    expect(result.totalMiscellaneousIncomeJpy.toNumber()).toBe(1_450_000);
  });

  it("取得費に負の値を入力するとエラーになる", () => {
    expect(() =>
      estimateCryptoIncomeWithUnknownCostBasis({
        trades: [{ label: "不正値", proceedsJpy: 100, actualAcquisitionCostJpy: -1 }],
      }),
    ).toThrow();
  });

  it("取引が0件の場合は合計も0になる", () => {
    const result = estimateCryptoIncomeWithUnknownCostBasis({ trades: [] });
    expect(result.totalProceedsJpy.toNumber()).toBe(0);
    expect(result.totalAcquisitionCostJpy.toNumber()).toBe(0);
    expect(result.totalMiscellaneousIncomeJpy.toNumber()).toBe(0);
  });
});
