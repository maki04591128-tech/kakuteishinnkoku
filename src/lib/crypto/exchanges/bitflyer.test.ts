import { describe, expect, it } from "vitest";
<<<<<<< HEAD
import { parseBitflyerTradeHistoryCsv } from "./bitflyer";
=======
import { parseBitflyerCsv } from "./bitflyer";
>>>>>>> origin/claude/wonderful-edison-xzm3zs

const HEADER =
  "取引日時,通貨,取引種別,取引価格,通貨1,通貨1数量,手数料,通貨1の対円レート,通貨2,通貨2数量,自己・媒介,注文ID,備考";

<<<<<<< HEAD
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
=======
describe("parseBitflyerCsv", () => {
  it("BTC_JPYの買い注文を解析する", () => {
    const csv = [
      HEADER,
      "2026/1/10 10:00:00,BTC_JPY,BUY,5000000,BTC,0.1,0,5000000,JPY,-500000,,ORDER1,",
    ].join("\n");

    const result = parseBitflyerCsv(csv);
    expect(result.skippedRows).toEqual([]);
    expect(result.rows).toHaveLength(1);

    const [row] = result.rows;
    expect(row.symbol).toBe("BTC");
    expect(row.type).toBe("BUY");
    expect(row.quantity.toNumber()).toBe(0.1);
    expect(row.unitPriceJpy.toNumber()).toBe(5000000);
    expect(row.feeJpy.toNumber()).toBe(0);
  });

  it("手数料を通貨1の対円レートで円換算する", () => {
    const csv = [
      HEADER,
      "2026/1/10 10:00:00,BTC_JPY,SELL,5000000,BTC,0.1,0.0001,5000000,JPY,500000,,ORDER2,",
    ].join("\n");

    const result = parseBitflyerCsv(csv);
    expect(result.rows[0].feeJpy.toNumber()).toBe(500); // 0.0001 * 5,000,000
    expect(result.rows[0].type).toBe("SELL");
  });

  it("暗号資産同士の交換はスキップして理由を記録する", () => {
    const csv = [
      HEADER,
      "2026/1/10 10:00:00,ETH_BTC,BUY,0.05,ETH,1,0,300000,BTC,-0.05,,ORDER3,",
    ].join("\n");

    const result = parseBitflyerCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].reason).toContain("暗号資産同士の交換");
  });

  it("必須カラムが欠けている場合はエラーを投げる", () => {
    expect(() => parseBitflyerCsv("通貨1,通貨2\nBTC,JPY")).toThrow();
  });

  it("解釈できない行はスキップし処理を継続する", () => {
    const csv = [
      HEADER,
      "invalid-date,BTC_JPY,BUY,5000000,BTC,0.1,0,5000000,JPY,-500000,,ORDER4,",
      "2026/1/11 10:00:00,BTC_JPY,BUY,5000000,BTC,0.1,0,5000000,JPY,-500000,,ORDER5,",
    ].join("\n");

    const result = parseBitflyerCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.skippedRows).toHaveLength(1);
>>>>>>> origin/claude/wonderful-edison-xzm3zs
  });
});
