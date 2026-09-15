import { describe, expect, it } from "vitest";
import { parseBitflyerTradeHistoryCsv } from "./bitflyer";

const HEADER =
  "取引日時,通貨,取引種別,取引価格,通貨1,通貨1数量,手数料,通貨1の対円レート,通貨2,通貨2数量,自己・媒介,注文ID,備考";

describe("parseBitflyerTradeHistoryCsv", () => {
  it("JPY建ての買い・売り行をCryptoTrade形式に変換する", () => {
    const csv = [
      HEADER,
      "2024/03/01 10:00:00,BTC_JPY,現物買い,5000000,BTC,0.1,50,5000000,JPY,500000,自己,ORDER1,",
      "2024/06/15 09:30:00,BTC_JPY,現物売り,6000000,BTC,0.05,30,6000000,JPY,300000,自己,ORDER2,",
    ].join("\n");

    const result = parseBitflyerTradeHistoryCsv(csv);

    expect(result.skippedRows).toEqual([]);
    expect(result.rows).toHaveLength(2);

    expect(result.rows[0]).toMatchObject({
      symbol: "BTC",
      type: "BUY",
      memo: "ORDER1",
    });
    expect(result.rows[0].quantity.toString()).toBe("0.1");
    expect(result.rows[0].unitPriceJpy.toString()).toBe("5000000");
    expect(result.rows[0].feeJpy.toString()).toBe("50");

    expect(result.rows[1]).toMatchObject({ symbol: "BTC", type: "SELL" });
    expect(result.rows[1].quantity.toString()).toBe("0.05");
  });

  it("通貨2がJPY以外の行はスキップする", () => {
    const csv = [
      HEADER,
      "2024/03/01 10:00:00,ETH_BTC,現物買い,0.05,ETH,1,0.001,300000,BTC,0.05,自己,ORDER3,",
    ].join("\n");

    const result = parseBitflyerTradeHistoryCsv(csv);

    expect(result.rows).toEqual([]);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].reason).toContain("JPY建て以外");
  });

  it("購入・売却以外の取引種別はスキップする", () => {
    const csv = [
      HEADER,
      "2024/03/01 10:00:00,BTC_JPY,入金,0,BTC,0.1,0,5000000,JPY,0,自己,ORDER4,",
    ].join("\n");

    const result = parseBitflyerTradeHistoryCsv(csv);

    expect(result.rows).toEqual([]);
    expect(result.skippedRows[0].reason).toContain("未対応の取引種別");
  });

  it("必須カラムが無いCSVはエラーにする", () => {
    expect(() => parseBitflyerTradeHistoryCsv("foo,bar\n1,2")).toThrow(
      /bitFlyerの取引履歴CSVとして認識できませんでした/,
    );
  });
});
