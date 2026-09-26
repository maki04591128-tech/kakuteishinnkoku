import { describe, expect, it } from "vitest";
import { estimateTokenServiceCompensationIncome } from "./tokenServiceCompensationIncome";

describe("estimateTokenServiceCompensationIncome", () => {
  it("請負契約分は雑所得(収入-必要経費)として計算する", () => {
    // 時価20万円のトークン報酬-必要経費3万円=17万円
    const result = estimateTokenServiceCompensationIncome({
      items: [
        {
          description: "業務委託先A",
          contractType: "CONTRACT",
          tokenFairValueJpy: 200_000,
          fairValueDifficultToDetermine: false,
          contractualServiceValueJpy: 0,
          necessaryExpensesJpy: 30_000,
        },
      ],
    });
    expect(result.businessOrMiscRevenueJpy.toNumber()).toBe(200_000);
    expect(result.businessOrMiscExpensesJpy.toNumber()).toBe(30_000);
    expect(result.businessOrMiscIncomeJpy.toNumber()).toBe(170_000);
    expect(result.additionalEmploymentRevenueJpy.toNumber()).toBe(0);
  });

  it("雇用契約分は必要経費を無視し、対価の額の合計のみ返す", () => {
    const result = estimateTokenServiceCompensationIncome({
      items: [
        {
          description: "勤務先B",
          contractType: "EMPLOYMENT",
          tokenFairValueJpy: 100_000,
          fairValueDifficultToDetermine: false,
          contractualServiceValueJpy: 0,
          necessaryExpensesJpy: 50_000,
        },
      ],
    });
    expect(result.additionalEmploymentRevenueJpy.toNumber()).toBe(100_000);
    expect(result.businessOrMiscRevenueJpy.toNumber()).toBe(0);
    expect(result.businessOrMiscIncomeJpy.toNumber()).toBe(0);
  });

  it("時価算定が困難な場合は契約などによって定められた対価の額を使う", () => {
    const result = estimateTokenServiceCompensationIncome({
      items: [
        {
          description: "業務委託先C",
          contractType: "CONTRACT",
          tokenFairValueJpy: 999_999,
          fairValueDifficultToDetermine: true,
          contractualServiceValueJpy: 150_000,
          necessaryExpensesJpy: 0,
        },
      ],
    });
    expect(result.items[0].compensationValueJpy.toNumber()).toBe(150_000);
    expect(result.businessOrMiscRevenueJpy.toNumber()).toBe(150_000);
  });

  it("複数件を契約類型ごとに合算する", () => {
    const result = estimateTokenServiceCompensationIncome({
      items: [
        {
          description: "業務委託先A",
          contractType: "CONTRACT",
          tokenFairValueJpy: 100_000,
          fairValueDifficultToDetermine: false,
          contractualServiceValueJpy: 0,
          necessaryExpensesJpy: 10_000,
        },
        {
          description: "業務委託先D",
          contractType: "CONTRACT",
          tokenFairValueJpy: 50_000,
          fairValueDifficultToDetermine: false,
          contractualServiceValueJpy: 0,
          necessaryExpensesJpy: 0,
        },
        {
          description: "勤務先B",
          contractType: "EMPLOYMENT",
          tokenFairValueJpy: 30_000,
          fairValueDifficultToDetermine: false,
          contractualServiceValueJpy: 0,
          necessaryExpensesJpy: 0,
        },
      ],
    });
    expect(result.businessOrMiscRevenueJpy.toNumber()).toBe(150_000);
    expect(result.businessOrMiscExpensesJpy.toNumber()).toBe(10_000);
    expect(result.businessOrMiscIncomeJpy.toNumber()).toBe(140_000);
    expect(result.additionalEmploymentRevenueJpy.toNumber()).toBe(30_000);
  });

  it("必要経費が収入を上回る請負契約分は赤字(マイナス)をそのまま返す", () => {
    const result = estimateTokenServiceCompensationIncome({
      items: [
        {
          description: "業務委託先E",
          contractType: "CONTRACT",
          tokenFairValueJpy: 5_000,
          fairValueDifficultToDetermine: false,
          contractualServiceValueJpy: 0,
          necessaryExpensesJpy: 8_000,
        },
      ],
    });
    expect(result.businessOrMiscIncomeJpy.toNumber()).toBe(-3_000);
  });

  it("マイナスの入力値はエラーを投げる", () => {
    expect(() =>
      estimateTokenServiceCompensationIncome({
        items: [
          {
            description: "不正な入力",
            contractType: "CONTRACT",
            tokenFairValueJpy: -1,
            fairValueDifficultToDetermine: false,
            contractualServiceValueJpy: 0,
            necessaryExpensesJpy: 0,
          },
        ],
      }),
    ).toThrow();
  });
});
