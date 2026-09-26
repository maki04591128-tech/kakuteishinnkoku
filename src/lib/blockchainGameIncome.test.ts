import { describe, expect, it } from "vitest";
import { estimateBlockchainGameIncome } from "./blockchainGameIncome";

describe("estimateBlockchainGameIncome", () => {
  it("簡便法により年末一括評価の雑所得を計算する", () => {
    // ゲーム内通貨ベースの所得金額 = 12/31(1200) - 1/1(200) - 購入(300) = 700
    // 雑所得の金額 = 700 × 100円 = 70,000円
    const result = estimateBlockchainGameIncome({
      items: [
        {
          description: "ゲームA",
          isGameOnlyToken: false,
          valuationMethod: "SIMPLIFIED",
          principleReceipts: [],
          openingBalance: 200,
          closingBalance: 1200,
          purchasedAmount: 300,
          hasYearEndMarketValue: true,
          yearEndRateJpy: 100,
          midYearCryptoExchangeValueJpy: 0,
        },
      ],
    });
    expect(result.items[0].tokenBasedIncomeAmount.toNumber()).toBe(700);
    expect(result.items[0].yearEndValuationIncomeJpy.toNumber()).toBe(70_000);
    expect(result.items[0].miscIncomeJpy.toNumber()).toBe(70_000);
    expect(result.totalMiscIncomeJpy.toNumber()).toBe(70_000);
  });

  it("年中に暗号資産へ交換した分は年末評価額とは別に加算する", () => {
    const result = estimateBlockchainGameIncome({
      items: [
        {
          description: "ゲームB",
          isGameOnlyToken: false,
          valuationMethod: "SIMPLIFIED",
          principleReceipts: [],
          openingBalance: 0,
          closingBalance: 500,
          purchasedAmount: 0,
          hasYearEndMarketValue: true,
          yearEndRateJpy: 10,
          midYearCryptoExchangeValueJpy: 30_000,
        },
      ],
    });
    // 年末評価分 500×10=5,000円 + 年中交換分 30,000円 = 35,000円
    expect(result.items[0].yearEndValuationIncomeJpy.toNumber()).toBe(5_000);
    expect(result.items[0].midYearExchangeIncomeJpy.toNumber()).toBe(30_000);
    expect(result.items[0].miscIncomeJpy.toNumber()).toBe(35_000);
  });

  it("時価の算定が困難な場合、年末評価分は0円として扱うが年中交換分は課税対象のまま", () => {
    const result = estimateBlockchainGameIncome({
      items: [
        {
          description: "ゲームC(時価算定困難)",
          isGameOnlyToken: false,
          valuationMethod: "SIMPLIFIED",
          principleReceipts: [],
          openingBalance: 0,
          closingBalance: 10_000,
          purchasedAmount: 0,
          hasYearEndMarketValue: false,
          yearEndRateJpy: 999,
          midYearCryptoExchangeValueJpy: 15_000,
        },
      ],
    });
    expect(result.items[0].yearEndValuationIncomeJpy.toNumber()).toBe(0);
    expect(result.items[0].midYearExchangeIncomeJpy.toNumber()).toBe(15_000);
    expect(result.items[0].miscIncomeJpy.toNumber()).toBe(15_000);
  });

  it("ゲーム内でしか使用できないトークンは課税対象外(常に0円)", () => {
    const result = estimateBlockchainGameIncome({
      items: [
        {
          description: "ゲーム内限定トークン",
          isGameOnlyToken: true,
          valuationMethod: "SIMPLIFIED",
          principleReceipts: [],
          openingBalance: 0,
          closingBalance: 100_000,
          purchasedAmount: 0,
          hasYearEndMarketValue: true,
          yearEndRateJpy: 50,
          midYearCryptoExchangeValueJpy: 20_000,
        },
      ],
    });
    expect(result.items[0].taxable).toBe(false);
    expect(result.items[0].yearEndValuationIncomeJpy.toNumber()).toBe(0);
    expect(result.items[0].midYearExchangeIncomeJpy.toNumber()).toBe(0);
    expect(result.items[0].miscIncomeJpy.toNumber()).toBe(0);
    expect(result.totalMiscIncomeJpy.toNumber()).toBe(0);
  });

  it("使用が取得を上回ると赤字(マイナス)になり得る", () => {
    const result = estimateBlockchainGameIncome({
      items: [
        {
          description: "ゲームD",
          isGameOnlyToken: false,
          valuationMethod: "SIMPLIFIED",
          principleReceipts: [],
          openingBalance: 1000,
          closingBalance: 100,
          purchasedAmount: 0,
          hasYearEndMarketValue: true,
          yearEndRateJpy: 5,
          midYearCryptoExchangeValueJpy: 0,
        },
      ],
    });
    // 100 - 1000 - 0 = -900 -> -900 × 5円 = -4,500円
    expect(result.items[0].miscIncomeJpy.toNumber()).toBe(-4_500);
  });

  it("複数トークンを合算する", () => {
    const result = estimateBlockchainGameIncome({
      items: [
        {
          description: "ゲームA",
          isGameOnlyToken: false,
          valuationMethod: "SIMPLIFIED",
          principleReceipts: [],
          openingBalance: 0,
          closingBalance: 100,
          purchasedAmount: 0,
          hasYearEndMarketValue: true,
          yearEndRateJpy: 10,
          midYearCryptoExchangeValueJpy: 0,
        },
        {
          description: "ゲームB",
          isGameOnlyToken: false,
          valuationMethod: "SIMPLIFIED",
          principleReceipts: [],
          openingBalance: 0,
          closingBalance: 200,
          purchasedAmount: 0,
          hasYearEndMarketValue: true,
          yearEndRateJpy: 5,
          midYearCryptoExchangeValueJpy: 0,
        },
      ],
    });
    expect(result.totalMiscIncomeJpy.toNumber()).toBe(1_000 + 1_000);
  });

  it("負の入力値はエラーになる(簡便法)", () => {
    expect(() =>
      estimateBlockchainGameIncome({
        items: [
          {
            description: "不正な入力",
            isGameOnlyToken: false,
            valuationMethod: "SIMPLIFIED",
            principleReceipts: [],
            openingBalance: -1,
            closingBalance: 0,
            purchasedAmount: 0,
            hasYearEndMarketValue: true,
            yearEndRateJpy: 0,
            midYearCryptoExchangeValueJpy: 0,
          },
        ],
      }),
    ).toThrow();
  });

  it("入力が0件の場合は合計0になる", () => {
    const result = estimateBlockchainGameIncome({ items: [] });
    expect(result.items).toHaveLength(0);
    expect(result.totalMiscIncomeJpy.toNumber()).toBe(0);
  });

  it("原則法により取得の都度の時価評価分を合算する", () => {
    // 雑所得の金額 = 100×10 + 50×20 = 1,000 + 1,000 = 2,000円
    const result = estimateBlockchainGameIncome({
      items: [
        {
          description: "ゲームE(原則法)",
          isGameOnlyToken: false,
          valuationMethod: "PRINCIPLE",
          principleReceipts: [
            { quantity: 100, unitPriceJpy: 10 },
            { quantity: 50, unitPriceJpy: 20 },
          ],
          openingBalance: 0,
          closingBalance: 0,
          purchasedAmount: 0,
          hasYearEndMarketValue: false,
          yearEndRateJpy: 0,
          midYearCryptoExchangeValueJpy: 0,
        },
      ],
    });
    expect(result.items[0].valuationMethod).toBe("PRINCIPLE");
    expect(result.items[0].tokenBasedIncomeAmount.toNumber()).toBe(150);
    expect(result.items[0].principleIncomeJpy.toNumber()).toBe(2_000);
    expect(result.items[0].yearEndValuationIncomeJpy.toNumber()).toBe(0);
    expect(result.items[0].midYearExchangeIncomeJpy.toNumber()).toBe(0);
    expect(result.items[0].miscIncomeJpy.toNumber()).toBe(2_000);
    expect(result.totalMiscIncomeJpy.toNumber()).toBe(2_000);
  });

  it("原則法でゲーム内限定トークンは課税対象外(常に0円)", () => {
    const result = estimateBlockchainGameIncome({
      items: [
        {
          description: "ゲーム内限定トークン(原則法)",
          isGameOnlyToken: true,
          valuationMethod: "PRINCIPLE",
          principleReceipts: [{ quantity: 1000, unitPriceJpy: 100 }],
          openingBalance: 0,
          closingBalance: 0,
          purchasedAmount: 0,
          hasYearEndMarketValue: false,
          yearEndRateJpy: 0,
          midYearCryptoExchangeValueJpy: 0,
        },
      ],
    });
    expect(result.items[0].taxable).toBe(false);
    expect(result.items[0].principleIncomeJpy.toNumber()).toBe(0);
    expect(result.items[0].miscIncomeJpy.toNumber()).toBe(0);
  });

  it("原則法と簡便法のトークンを混在させて合算できる", () => {
    const result = estimateBlockchainGameIncome({
      items: [
        {
          description: "原則法のトークン",
          isGameOnlyToken: false,
          valuationMethod: "PRINCIPLE",
          principleReceipts: [{ quantity: 10, unitPriceJpy: 100 }],
          openingBalance: 0,
          closingBalance: 0,
          purchasedAmount: 0,
          hasYearEndMarketValue: false,
          yearEndRateJpy: 0,
          midYearCryptoExchangeValueJpy: 0,
        },
        {
          description: "簡便法のトークン",
          isGameOnlyToken: false,
          valuationMethod: "SIMPLIFIED",
          principleReceipts: [],
          openingBalance: 0,
          closingBalance: 100,
          purchasedAmount: 0,
          hasYearEndMarketValue: true,
          yearEndRateJpy: 5,
          midYearCryptoExchangeValueJpy: 0,
        },
      ],
    });
    // 原則法: 10×100=1,000円、簡便法: 100×5=500円 -> 合計1,500円
    expect(result.totalMiscIncomeJpy.toNumber()).toBe(1_500);
  });

  it("原則法の負の入力値はエラーになる", () => {
    expect(() =>
      estimateBlockchainGameIncome({
        items: [
          {
            description: "不正な入力(原則法)",
            isGameOnlyToken: false,
            valuationMethod: "PRINCIPLE",
            principleReceipts: [{ quantity: -1, unitPriceJpy: 100 }],
            openingBalance: 0,
            closingBalance: 0,
            purchasedAmount: 0,
            hasYearEndMarketValue: false,
            yearEndRateJpy: 0,
            midYearCryptoExchangeValueJpy: 0,
          },
        ],
      }),
    ).toThrow();
  });
});
