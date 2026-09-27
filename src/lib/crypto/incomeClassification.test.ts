import { describe, expect, it } from "vitest";
import { determineCryptoIncomeCategory } from "./incomeClassification";

describe("determineCryptoIncomeCategory", () => {
  it("収入金額が300万円以下なら雑所得(その他雑所得)になる(FAQ問2-2原則)", () => {
    const result = determineCryptoIncomeCategory({
      totalRevenueJpy: 3_000_000,
      isIncidentalToExistingBusiness: false,
      hasBookkeeping: false,
    });
    expect(result.category).toBe("MISCELLANEOUS_OTHER");
    expect(result.categoryLabel).toBe("雑所得(その他雑所得)");
  });

  it("収入金額が300万円をわずかに超え帳簿書類の保存が無い場合は雑所得(業務に係る雑所得)になる", () => {
    const result = determineCryptoIncomeCategory({
      totalRevenueJpy: 3_000_001,
      isIncidentalToExistingBusiness: false,
      hasBookkeeping: false,
    });
    expect(result.category).toBe("MISCELLANEOUS_BUSINESS");
    expect(result.categoryLabel).toBe("雑所得(業務に係る雑所得)");
  });

  it("収入金額が300万円を超え帳簿書類の保存がある場合は原則として事業所得になる", () => {
    const result = determineCryptoIncomeCategory({
      totalRevenueJpy: 5_000_000,
      isIncidentalToExistingBusiness: false,
      hasBookkeeping: true,
    });
    expect(result.category).toBe("BUSINESS_INCOME");
    expect(result.categoryLabel).toBe("事業所得");
  });

  it("profitMotiveRecognizedを省略した場合は営利性ありとして扱い事業所得になる", () => {
    const result = determineCryptoIncomeCategory({
      totalRevenueJpy: 10_000_000,
      isIncidentalToExistingBusiness: false,
      hasBookkeeping: true,
    });
    expect(result.category).toBe("BUSINESS_INCOME");
  });

  it("収入金額300万円超・帳簿保存あり・営利性が認められない場合は個別判断になる(FAQ問2-2の注)", () => {
    const result = determineCryptoIncomeCategory({
      totalRevenueJpy: 5_000_000,
      isIncidentalToExistingBusiness: false,
      hasBookkeeping: true,
      profitMotiveRecognized: false,
    });
    expect(result.category).toBe("NEEDS_INDIVIDUAL_JUDGMENT");
  });

  it("事業に付随した暗号資産取引は収入金額が300万円以下でも事業所得になる", () => {
    const result = determineCryptoIncomeCategory({
      totalRevenueJpy: 100_000,
      isIncidentalToExistingBusiness: true,
      hasBookkeeping: false,
    });
    expect(result.category).toBe("BUSINESS_INCOME");
    expect(result.reason).toContain("付随");
  });

  it("事業付随の判定は帳簿書類の有無や営利性の判定より優先される", () => {
    const result = determineCryptoIncomeCategory({
      totalRevenueJpy: 10_000_000,
      isIncidentalToExistingBusiness: true,
      hasBookkeeping: false,
      profitMotiveRecognized: false,
    });
    expect(result.category).toBe("BUSINESS_INCOME");
  });

  it("収入金額がちょうど300万円の境界値は雑所得(その他雑所得)のまま(超える場合のみ区分変更)", () => {
    const result = determineCryptoIncomeCategory({
      totalRevenueJpy: 3_000_000,
      isIncidentalToExistingBusiness: false,
      hasBookkeeping: true,
    });
    expect(result.category).toBe("MISCELLANEOUS_OTHER");
  });

  it("収入金額が負の値だとエラーになる", () => {
    expect(() =>
      determineCryptoIncomeCategory({
        totalRevenueJpy: -1,
        isIncidentalToExistingBusiness: false,
        hasBookkeeping: false,
      }),
    ).toThrow();
  });

  it("結果にtotalRevenueJpyがDecimalとして反映される", () => {
    const result = determineCryptoIncomeCategory({
      totalRevenueJpy: 4_500_000,
      isIncidentalToExistingBusiness: false,
      hasBookkeeping: false,
    });
    expect(result.totalRevenueJpy.toNumber()).toBe(4_500_000);
  });
});
