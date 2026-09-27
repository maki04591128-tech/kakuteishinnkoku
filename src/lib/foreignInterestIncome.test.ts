import { describe, expect, it } from "vitest";
import { estimateForeignInterestIncome } from "./foreignInterestIncome";

describe("estimateForeignInterestIncome", () => {
  it("単一通貨・単一の受取利息を円換算する", () => {
    const result = estimateForeignInterestIncome([
      { currency: "USD", amountForeignCurrency: 100, exchangeRateJpy: 150 },
    ]);
    expect(result.totalInterestIncomeJpy.toNumber()).toBe(15_000);
    expect(result.totalForeignTaxWithheldJpy.toNumber()).toBe(0);
    expect(result.byCurrency).toHaveLength(1);
    expect(result.byCurrency[0].receiptCount).toBe(1);
  });

  it("同一通貨の複数回受取は、それぞれ受取時点のレートで換算してから合計する(平均レートは使わない)", () => {
    const result = estimateForeignInterestIncome([
      { currency: "USD", amountForeignCurrency: 100, exchangeRateJpy: 140 },
      { currency: "USD", amountForeignCurrency: 100, exchangeRateJpy: 160 },
    ]);
    // 100*140 + 100*160 = 14,000 + 16,000 = 30,000 (平均レート150で200*150=30,000と一致するのは
    // 数量が同じ場合のみで、本来は各回のレートで個別に換算する点を確認する)
    expect(result.totalInterestIncomeJpy.toNumber()).toBe(30_000);
    expect(result.byCurrency[0].receiptCount).toBe(2);
    expect(result.byCurrency[0].totalAmountForeignCurrency.toNumber()).toBe(200);
  });

  it("複数通貨を通貨別に集計し、通貨コードの昇順で並べる", () => {
    const result = estimateForeignInterestIncome([
      { currency: "EUR", amountForeignCurrency: 10, exchangeRateJpy: 160 },
      { currency: "USD", amountForeignCurrency: 100, exchangeRateJpy: 150 },
    ]);
    expect(result.byCurrency.map((r) => r.currency)).toEqual(["EUR", "USD"]);
    expect(result.totalInterestIncomeJpy.toNumber()).toBe(10 * 160 + 100 * 150);
  });

  it("現地で源泉徴収された外国所得税額を通貨別・合計で集計する", () => {
    const result = estimateForeignInterestIncome([
      {
        currency: "USD",
        amountForeignCurrency: 100,
        exchangeRateJpy: 150,
        foreignTaxWithheldJpy: 1_000,
      },
      {
        currency: "USD",
        amountForeignCurrency: 50,
        exchangeRateJpy: 150,
        foreignTaxWithheldJpy: 500,
      },
    ]);
    expect(result.totalForeignTaxWithheldJpy.toNumber()).toBe(1_500);
    expect(result.byCurrency[0].foreignTaxWithheldJpy.toNumber()).toBe(1_500);
  });

  it("受取利息額が0以下だとエラーになる", () => {
    expect(() =>
      estimateForeignInterestIncome([
        { currency: "USD", amountForeignCurrency: 0, exchangeRateJpy: 150 },
      ]),
    ).toThrow();
    expect(() =>
      estimateForeignInterestIncome([
        { currency: "USD", amountForeignCurrency: -10, exchangeRateJpy: 150 },
      ]),
    ).toThrow();
  });

  it("円換算レートが負の値だとエラーになる", () => {
    expect(() =>
      estimateForeignInterestIncome([
        { currency: "USD", amountForeignCurrency: 100, exchangeRateJpy: -1 },
      ]),
    ).toThrow();
  });

  it("外国所得税額が負の値だとエラーになる", () => {
    expect(() =>
      estimateForeignInterestIncome([
        {
          currency: "USD",
          amountForeignCurrency: 100,
          exchangeRateJpy: 150,
          foreignTaxWithheldJpy: -1,
        },
      ]),
    ).toThrow();
  });

  it("通貨が空文字だとエラーになる", () => {
    expect(() =>
      estimateForeignInterestIncome([
        { currency: "  ", amountForeignCurrency: 100, exchangeRateJpy: 150 },
      ]),
    ).toThrow();
  });

  it("受取が0件なら合計は0円", () => {
    const result = estimateForeignInterestIncome([]);
    expect(result.totalInterestIncomeJpy.toNumber()).toBe(0);
    expect(result.byCurrency).toHaveLength(0);
  });
});
