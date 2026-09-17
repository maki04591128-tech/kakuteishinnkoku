import { describe, expect, it } from "vitest";
import { calculateNisaLifetimeQuotaUsage, calculateNisaQuotaUsage } from "./nisaQuota";

describe("calculateNisaQuotaUsage", () => {
  it("つみたて投資枠と成長投資枠を区別して集計する", () => {
    const result = calculateNisaQuotaUsage([
      { type: "BUY", isNisa: true, nisaType: "TSUMITATE", quantity: 10, unitPriceJpy: 10_000 },
      { type: "BUY", isNisa: true, nisaType: "GROWTH", quantity: 5, unitPriceJpy: 100_000 },
    ]);

    expect(result.tsumitateUsedJpy.toString()).toBe("100000");
    expect(result.tsumitateRemainingJpy.toString()).toBe("1100000");
    expect(result.growthUsedJpy.toString()).toBe("500000");
    expect(result.growthRemainingJpy.toString()).toBe("1900000");
    expect(result.unclassifiedBuyJpy.toString()).toBe("0");
  });

  it("課税口座の取引・NISA口座の売却/配当は枠の使用額に含めない", () => {
    const result = calculateNisaQuotaUsage([
      { type: "BUY", isNisa: false, nisaType: "GROWTH", quantity: 1, unitPriceJpy: 1_000_000 },
      { type: "SELL", isNisa: true, nisaType: "GROWTH", quantity: 1, unitPriceJpy: 1_000_000 },
      { type: "DIVIDEND", isNisa: true, nisaType: "GROWTH", quantity: 1, unitPriceJpy: 1_000 },
    ]);

    expect(result.tsumitateUsedJpy.toString()).toBe("0");
    expect(result.growthUsedJpy.toString()).toBe("0");
    expect(result.unclassifiedBuyJpy.toString()).toBe("0");
  });

  it("枠区分が未入力のNISA買付は unclassifiedBuyJpy に集計し、いずれの枠の使用額にも含めない", () => {
    const result = calculateNisaQuotaUsage([
      { type: "BUY", isNisa: true, nisaType: null, quantity: 3, unitPriceJpy: 10_000 },
    ]);

    expect(result.unclassifiedBuyJpy.toString()).toBe("30000");
    expect(result.tsumitateUsedJpy.toString()).toBe("0");
    expect(result.growthUsedJpy.toString()).toBe("0");
  });

  it("年間上限を超えて買い付けた場合は残枠が負の値になる", () => {
    const result = calculateNisaQuotaUsage([
      {
        type: "BUY",
        isNisa: true,
        nisaType: "TSUMITATE",
        quantity: 1,
        unitPriceJpy: 1_300_000,
      },
    ]);

    expect(result.tsumitateUsedJpy.toString()).toBe("1300000");
    expect(result.tsumitateRemainingJpy.toString()).toBe("-100000");
  });
});

describe("calculateNisaLifetimeQuotaUsage", () => {
  it("年始時点の使用額に当年の買付額を加算して当年末の使用額を求める", () => {
    const result = calculateNisaLifetimeQuotaUsage(
      [
        { type: "BUY", isNisa: true, nisaType: "TSUMITATE", quantity: 10, unitPriceJpy: 10_000 },
        { type: "BUY", isNisa: true, nisaType: "GROWTH", quantity: 5, unitPriceJpy: 100_000 },
      ],
      [
        { nisaType: "TSUMITATE", openingUsedJpy: 1_000_000 },
        { nisaType: "GROWTH", openingUsedJpy: 2_000_000 },
      ],
    );

    const tsumitate = result.byType.find((t) => t.nisaType === "TSUMITATE")!;
    const growth = result.byType.find((t) => t.nisaType === "GROWTH")!;
    expect(tsumitate.closingUsedJpy.toString()).toBe("1100000");
    expect(growth.closingUsedJpy.toString()).toBe("2500000");
    expect(result.totalClosingUsedJpy.toString()).toBe("3600000");
    expect(result.exceededOverallJpy.toString()).toBe("0");
    expect(result.exceededGrowthJpy.toString()).toBe("0");
  });

  it("当年中の売却(手入力)は翌年への繰越額(当年末使用額)を減らすが、当年の買付可否判定には影響しない", () => {
    const result = calculateNisaLifetimeQuotaUsage(
      [{ type: "BUY", isNisa: true, nisaType: "GROWTH", quantity: 1, unitPriceJpy: 500_000 }],
      [{ nisaType: "GROWTH", openingUsedJpy: 3_000_000, soldCostBasisJpy: 1_000_000 }],
    );

    const growth = result.byType.find((t) => t.nisaType === "GROWTH")!;
    // 年始時点の残り成長投資枠(1200万-300万=900万)の判定は売却前の年始残高を使う
    expect(result.growthRemainingAtYearStartJpy.toString()).toBe("9000000");
    // 繰越額は年始使用額+当年買付-当年売却(簿価)
    expect(growth.closingUsedJpy.toString()).toBe("2500000");
  });

  it("年始時点の残り生涯投資枠(総枠)を超える買付があれば超過額を報告する", () => {
    const result = calculateNisaLifetimeQuotaUsage(
      [{ type: "BUY", isNisa: true, nisaType: "TSUMITATE", quantity: 1, unitPriceJpy: 1_000_000 }],
      [
        { nisaType: "TSUMITATE", openingUsedJpy: 17_500_000 },
        { nisaType: "GROWTH", openingUsedJpy: 0 },
      ],
    );

    expect(result.remainingAtYearStartJpy.toString()).toBe("500000");
    expect(result.exceededOverallJpy.toString()).toBe("500000");
  });

  it("年始時点の残り成長投資枠(生涯上限1,200万円分)を超える成長投資枠買付があれば超過額を報告する", () => {
    const result = calculateNisaLifetimeQuotaUsage(
      [{ type: "BUY", isNisa: true, nisaType: "GROWTH", quantity: 1, unitPriceJpy: 1_500_000 }],
      [{ nisaType: "GROWTH", openingUsedJpy: 11_000_000 }],
    );

    expect(result.growthRemainingAtYearStartJpy.toString()).toBe("1000000");
    expect(result.exceededGrowthJpy.toString()).toBe("500000");
    // 総枠(1800万)の残りは十分にあるため、総枠側の超過は発生しない
    expect(result.exceededOverallJpy.toString()).toBe("0");
  });

  it("年始残高の登録が無い場合は使用額0として扱う", () => {
    const result = calculateNisaLifetimeQuotaUsage([], []);

    expect(result.totalOpeningUsedJpy.toString()).toBe("0");
    expect(result.totalClosingUsedJpy.toString()).toBe("0");
    expect(result.remainingAtYearStartJpy.toString()).toBe("18000000");
    expect(result.growthRemainingAtYearStartJpy.toString()).toBe("12000000");
  });
});
