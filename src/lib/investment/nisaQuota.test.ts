import { describe, expect, it } from "vitest";
import { calculateNisaQuotaUsage } from "./nisaQuota";

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
