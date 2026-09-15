import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  calculateCryptoPortfolioYear,
  calculateCryptoYear,
} from "./calculator";

describe("calculateCryptoYear (総平均法)", () => {
  it("国税庁FAQの計算例と一致する: 2回購入後に一部売却", () => {
    // 3/9 に 4,000,000円で2BTC購入、5/28 に 5BTCを4,500,000円で購入、
    // 9/15 に 2BTCを2,000,000円で売却 という国税庁FAQの設例に準拠。
    const result = calculateCryptoYear("BTC", [
      { type: "BUY", quantity: 2, unitPriceJpy: 2_000_000 },
      { type: "BUY", quantity: 5, unitPriceJpy: 900_000 },
      { type: "SELL", quantity: 2, unitPriceJpy: 1_000_000 },
    ]);

    // 総平均単価 = (2*2,000,000 + 5*900,000) / 7 = 8,500,000 / 7 ≒ 1,214,285.71
    expect(result.averageUnitCostJpy.toDecimalPlaces(2).toNumber()).toBeCloseTo(
      1_214_285.71,
      1,
    );
    // 譲渡収入 2,000,000 - 譲渡原価(平均単価*2)
    const expectedCost = result.averageUnitCostJpy.times(2);
    expect(result.costOfDisposedJpy.toString()).toBe(expectedCost.toString());
    expect(result.realizedGainJpy.toString()).toBe(
      new Decimal(2_000_000).minus(expectedCost).toString(),
    );
    expect(result.closingQuantity.toNumber()).toBe(5);
  });

  it("期首残高を翌年へ正しく繰り越せる", () => {
    const result = calculateCryptoYear("ETH", [
      { type: "SELL", quantity: 1, unitPriceJpy: 300_000 },
    ], {
      quantity: 2,
      costBasisJpy: 400_000, // 単価200,000円で2ETH保有
    });

    expect(result.averageUnitCostJpy.toNumber()).toBe(200_000);
    expect(result.realizedGainJpy.toNumber()).toBe(100_000);
    expect(result.closingQuantity.toNumber()).toBe(1);
    expect(result.closingCostJpy.toNumber()).toBe(200_000);
  });

  it("マイニング等のINCOMEは受取時に収入計上され、取得価額にもプールされる", () => {
    const result = calculateCryptoYear("BTC", [
      { type: "INCOME", quantity: 1, unitPriceJpy: 5_000_000 },
      { type: "SELL", quantity: 1, unitPriceJpy: 6_000_000 },
    ]);

    expect(result.incomeJpy.toNumber()).toBe(5_000_000);
    // 平均単価は5,000,000円 => 売却益は1,000,000円、収入と合わせて6,000,000円
    expect(result.realizedGainJpy.toNumber()).toBe(6_000_000);
  });

  it("暗号資産同士の交換(TRADE_IN/TRADE_OUT)を時価で評価する", () => {
    const result = calculateCryptoYear("BTC", [
      { type: "BUY", quantity: 1, unitPriceJpy: 3_000_000 },
      { type: "TRADE_OUT", quantity: 0.5, unitPriceJpy: 4_000_000 },
    ]);

    expect(result.proceedsJpy.toNumber()).toBe(2_000_000);
    expect(result.costOfDisposedJpy.toNumber()).toBe(1_500_000);
    expect(result.realizedGainJpy.toNumber()).toBe(500_000);
  });

  it("手数料は取得側で加算、譲渡側で控除される", () => {
    const result = calculateCryptoYear("BTC", [
      { type: "BUY", quantity: 1, unitPriceJpy: 1_000_000, feeJpy: 10_000 },
      { type: "SELL", quantity: 1, unitPriceJpy: 1_200_000, feeJpy: 5_000 },
    ]);

    expect(result.averageUnitCostJpy.toNumber()).toBe(1_010_000);
    expect(result.proceedsJpy.toNumber()).toBe(1_195_000);
    expect(result.realizedGainJpy.toNumber()).toBe(185_000);
  });

  it("期首+当年取得数量を超える売却はエラーになる", () => {
    expect(() =>
      calculateCryptoYear("BTC", [
        { type: "SELL", quantity: 1, unitPriceJpy: 100 },
      ]),
    ).toThrow();
  });

  it("数量が0以下の取引はエラーになる", () => {
    expect(() =>
      calculateCryptoYear("BTC", [
        { type: "BUY", quantity: 0, unitPriceJpy: 100 },
      ]),
    ).toThrow();
  });
});

describe("calculateCryptoYear (移動平均法)", () => {
  it("取得の都度平均単価を更新し、売却時点の平均単価で原価を計算する", () => {
    // 1/10 に 2BTCを2,000,000円/BTCで購入(平均単価2,000,000円)、
    // 3/1 に 1BTCを2,500,000円で売却(原価は2,000,000円/BTC時点の単価)、
    // 5/1 に 5BTCを900,000円/BTCで購入(平均単価 = (1*2,000,000+5*900,000)/6 = 1,083,333.33)
    const result = calculateCryptoYear(
      "BTC",
      [
        { type: "BUY", quantity: 2, unitPriceJpy: 2_000_000, tradedAt: "2026-01-10" },
        { type: "SELL", quantity: 1, unitPriceJpy: 2_500_000, tradedAt: "2026-03-01" },
        { type: "BUY", quantity: 5, unitPriceJpy: 900_000, tradedAt: "2026-05-01" },
      ],
      undefined,
      "MOVING_AVERAGE",
    );

    // 売却時点の平均単価は2,000,000円 => 譲渡益は500,000円
    expect(result.costOfDisposedJpy.toNumber()).toBe(2_000_000);
    expect(result.realizedGainJpy.toNumber()).toBe(500_000);
    expect(result.closingQuantity.toNumber()).toBe(6);
    // 期末平均単価(参考値) = (1*2,000,000 + 5*900,000) / 6
    expect(result.averageUnitCostJpy.toDecimalPlaces(2).toNumber()).toBeCloseTo(
      1_083_333.33,
      1,
    );
  });

  it("取引の入力順序に関わらず tradedAt の昇順で計算する", () => {
    const chronological = calculateCryptoYear(
      "ETH",
      [
        { type: "BUY", quantity: 1, unitPriceJpy: 100_000, tradedAt: "2026-01-01" },
        { type: "SELL", quantity: 1, unitPriceJpy: 150_000, tradedAt: "2026-02-01" },
        { type: "BUY", quantity: 1, unitPriceJpy: 200_000, tradedAt: "2026-03-01" },
      ],
      undefined,
      "MOVING_AVERAGE",
    );
    const shuffled = calculateCryptoYear(
      "ETH",
      [
        { type: "BUY", quantity: 1, unitPriceJpy: 200_000, tradedAt: "2026-03-01" },
        { type: "SELL", quantity: 1, unitPriceJpy: 150_000, tradedAt: "2026-02-01" },
        { type: "BUY", quantity: 1, unitPriceJpy: 100_000, tradedAt: "2026-01-01" },
      ],
      undefined,
      "MOVING_AVERAGE",
    );

    expect(shuffled.realizedGainJpy.toString()).toBe(chronological.realizedGainJpy.toString());
    expect(shuffled.closingCostJpy.toString()).toBe(chronological.closingCostJpy.toString());
  });

  it("期首残高を平均単価計算に合算する", () => {
    const result = calculateCryptoYear(
      "BTC",
      [{ type: "SELL", quantity: 1, unitPriceJpy: 500_000, tradedAt: "2026-01-01" }],
      { quantity: 2, costBasisJpy: 400_000 },
      "MOVING_AVERAGE",
    );

    expect(result.costOfDisposedJpy.toNumber()).toBe(200_000);
    expect(result.realizedGainJpy.toNumber()).toBe(300_000);
    expect(result.closingQuantity.toNumber()).toBe(1);
  });

  it("tradedAt が無い取引が含まれる場合はエラーになる", () => {
    expect(() =>
      calculateCryptoYear(
        "BTC",
        [{ type: "BUY", quantity: 1, unitPriceJpy: 100 }],
        undefined,
        "MOVING_AVERAGE",
      ),
    ).toThrow(/tradedAt/);
  });

  it("その時点の保有数量を超える売却はエラーになる(期末合計内でも順序次第で不足しうる)", () => {
    expect(() =>
      calculateCryptoYear(
        "BTC",
        [
          { type: "SELL", quantity: 1, unitPriceJpy: 100, tradedAt: "2026-01-01" },
          { type: "BUY", quantity: 1, unitPriceJpy: 100, tradedAt: "2026-02-01" },
        ],
        undefined,
        "MOVING_AVERAGE",
      ),
    ).toThrow();
  });
});

describe("calculateCryptoPortfolioYear", () => {
  it("複数銘柄を混在させても銘柄別に正しく集計する", () => {
    const result = calculateCryptoPortfolioYear([
      { symbol: "BTC", type: "BUY", quantity: 1, unitPriceJpy: 3_000_000 },
      { symbol: "ETH", type: "BUY", quantity: 10, unitPriceJpy: 200_000 },
      { symbol: "BTC", type: "SELL", quantity: 1, unitPriceJpy: 3_500_000 },
      { symbol: "ETH", type: "SELL", quantity: 5, unitPriceJpy: 180_000 },
    ]);

    expect(result.bySymbol.map((r) => r.symbol)).toEqual(["BTC", "ETH"]);

    const btc = result.bySymbol.find((r) => r.symbol === "BTC")!;
    expect(btc.realizedGainJpy.toNumber()).toBe(500_000);

    const eth = result.bySymbol.find((r) => r.symbol === "ETH")!;
    expect(eth.realizedGainJpy.toNumber()).toBe(-100_000);

    expect(result.totalRealizedGainJpy.toNumber()).toBe(400_000);
  });

  it("当年取引が無くても期首残高がある銘柄は結果に含まれる", () => {
    const result = calculateCryptoPortfolioYear([], {
      BTC: { quantity: 1, costBasisJpy: 3_000_000 },
    });

    expect(result.bySymbol).toHaveLength(1);
    expect(result.bySymbol[0].closingQuantity.toNumber()).toBe(1);
    expect(result.totalRealizedGainJpy.toNumber()).toBe(0);
  });

  it("method: MOVING_AVERAGE を指定すると全銘柄が移動平均法で計算される", () => {
    const result = calculateCryptoPortfolioYear(
      [
        { symbol: "BTC", type: "BUY", quantity: 2, unitPriceJpy: 2_000_000, tradedAt: "2026-01-10" },
        { symbol: "BTC", type: "SELL", quantity: 1, unitPriceJpy: 2_500_000, tradedAt: "2026-03-01" },
      ],
      undefined,
      "MOVING_AVERAGE",
    );

    const btc = result.bySymbol.find((r) => r.symbol === "BTC")!;
    expect(btc.realizedGainJpy.toNumber()).toBe(500_000);
  });
});
