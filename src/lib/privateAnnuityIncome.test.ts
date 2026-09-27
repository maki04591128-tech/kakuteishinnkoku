import { describe, expect, it } from "vitest";
import { estimatePrivateAnnuityIncome } from "./privateAnnuityIncome";

describe("estimatePrivateAnnuityIncome", () => {
  it("確定年金(10年確定年金、年金年額100万円)の必要経費・雑所得を計算する", () => {
    const result = estimatePrivateAnnuityIncome([
      {
        annualAnnuityAmountJpy: 1_000_000,
        totalPremiumsPaidJpy: 8_000_000,
        totalScheduledPaymentJpy: 10_000_000,
      },
    ]);
    expect(result.contracts[0].necessaryExpenseRatio.toNumber()).toBe(0.8);
    expect(result.contracts[0].necessaryExpenseJpy.toNumber()).toBe(800_000);
    expect(result.contracts[0].miscIncomeJpy.toNumber()).toBe(200_000);
    expect(result.totalMiscIncomeJpy.toNumber()).toBe(200_000);
  });

  it("割合は小数点以下2位まで算出し、3位以下を切り上げる(施行令183条1項4号)", () => {
    const result = estimatePrivateAnnuityIncome([
      {
        annualAnnuityAmountJpy: 1_000_000,
        totalPremiumsPaidJpy: 750_100,
        totalScheduledPaymentJpy: 1_000_000,
      },
    ]);
    // 750,100 / 1,000,000 = 0.7501 -> 切り上げで0.76
    expect(result.contracts[0].necessaryExpenseRatio.toNumber()).toBe(0.76);
    expect(result.contracts[0].necessaryExpenseJpy.toNumber()).toBe(760_000);
    expect(result.contracts[0].miscIncomeJpy.toNumber()).toBe(240_000);
  });

  it("割り切れる場合は切り上げによる変化が無い", () => {
    const result = estimatePrivateAnnuityIncome([
      {
        annualAnnuityAmountJpy: 1_000_000,
        totalPremiumsPaidJpy: 750_000,
        totalScheduledPaymentJpy: 1_000_000,
      },
    ]);
    expect(result.contracts[0].necessaryExpenseRatio.toNumber()).toBe(0.75);
  });

  it("年金のほか一時金も支払う契約の場合、保険料総額を按分してから割合を計算する(施行令183条1項3号)", () => {
    const result = estimatePrivateAnnuityIncome([
      {
        annualAnnuityAmountJpy: 1_000_000,
        totalPremiumsPaidJpy: 9_000_000,
        totalScheduledPaymentJpy: 8_000_000,
        lumpSumAmountJpy: 2_000_000,
      },
    ]);
    // 按分後保険料総額 = 9,000,000 * 8,000,000/10,000,000 = 7,200,000
    // 割合 = 7,200,000/8,000,000 = 0.9
    expect(result.contracts[0].necessaryExpenseRatio.toNumber()).toBe(0.9);
    expect(result.contracts[0].necessaryExpenseJpy.toNumber()).toBe(900_000);
    expect(result.contracts[0].miscIncomeJpy.toNumber()).toBe(100_000);
  });

  it("支払開始後に分配を受けた剰余金・割戻金は必要経費控除の対象にならずそのまま加算する(施行令183条1項1号)", () => {
    const result = estimatePrivateAnnuityIncome([
      {
        annualAnnuityAmountJpy: 1_000_000,
        totalPremiumsPaidJpy: 8_000_000,
        totalScheduledPaymentJpy: 10_000_000,
        surplusDistributionJpy: 30_000,
      },
    ]);
    expect(result.contracts[0].necessaryExpenseJpy.toNumber()).toBe(800_000);
    expect(result.contracts[0].miscIncomeJpy.toNumber()).toBe(230_000);
  });

  it("複数契約の雑所得を合算する", () => {
    const result = estimatePrivateAnnuityIncome([
      {
        name: "A生命",
        annualAnnuityAmountJpy: 1_000_000,
        totalPremiumsPaidJpy: 8_000_000,
        totalScheduledPaymentJpy: 10_000_000,
      },
      {
        name: "B生命",
        annualAnnuityAmountJpy: 500_000,
        totalPremiumsPaidJpy: 3_000_000,
        totalScheduledPaymentJpy: 5_000_000,
      },
    ]);
    expect(result.contracts.map((c) => c.name)).toEqual(["A生命", "B生命"]);
    // 200,000 + (500,000 - 500,000*0.6) = 200,000 + 200,000
    expect(result.totalMiscIncomeJpy.toNumber()).toBe(400_000);
  });

  it("契約名を省略した場合は連番のラベルが付く", () => {
    const result = estimatePrivateAnnuityIncome([
      {
        annualAnnuityAmountJpy: 1_000_000,
        totalPremiumsPaidJpy: 8_000_000,
        totalScheduledPaymentJpy: 10_000_000,
      },
    ]);
    expect(result.contracts[0].name).toBe("契約1");
  });

  it("年金の額が負の値だとエラーになる", () => {
    expect(() =>
      estimatePrivateAnnuityIncome([
        {
          annualAnnuityAmountJpy: -1,
          totalPremiumsPaidJpy: 8_000_000,
          totalScheduledPaymentJpy: 10_000_000,
        },
      ]),
    ).toThrow();
  });

  it("保険料又は掛金の総額が負の値だとエラーになる", () => {
    expect(() =>
      estimatePrivateAnnuityIncome([
        {
          annualAnnuityAmountJpy: 1_000_000,
          totalPremiumsPaidJpy: -1,
          totalScheduledPaymentJpy: 10_000_000,
        },
      ]),
    ).toThrow();
  });

  it("支払総額(見込額)が0以下だとエラーになる", () => {
    expect(() =>
      estimatePrivateAnnuityIncome([
        {
          annualAnnuityAmountJpy: 1_000_000,
          totalPremiumsPaidJpy: 8_000_000,
          totalScheduledPaymentJpy: 0,
        },
      ]),
    ).toThrow();
    expect(() =>
      estimatePrivateAnnuityIncome([
        {
          annualAnnuityAmountJpy: 1_000_000,
          totalPremiumsPaidJpy: 8_000_000,
          totalScheduledPaymentJpy: -1,
        },
      ]),
    ).toThrow();
  });

  it("一時金の額が負の値だとエラーになる", () => {
    expect(() =>
      estimatePrivateAnnuityIncome([
        {
          annualAnnuityAmountJpy: 1_000_000,
          totalPremiumsPaidJpy: 8_000_000,
          totalScheduledPaymentJpy: 10_000_000,
          lumpSumAmountJpy: -1,
        },
      ]),
    ).toThrow();
  });

  it("剰余金・割戻金の額が負の値だとエラーになる", () => {
    expect(() =>
      estimatePrivateAnnuityIncome([
        {
          annualAnnuityAmountJpy: 1_000_000,
          totalPremiumsPaidJpy: 8_000_000,
          totalScheduledPaymentJpy: 10_000_000,
          surplusDistributionJpy: -1,
        },
      ]),
    ).toThrow();
  });

  it("契約が0件なら合計は0円", () => {
    const result = estimatePrivateAnnuityIncome([]);
    expect(result.totalMiscIncomeJpy.toNumber()).toBe(0);
    expect(result.contracts).toHaveLength(0);
  });
});
