import { describe, expect, it } from "vitest";
import { parseExchangeCryptoCsv } from "./exchangeImport";

describe("parseExchangeCryptoCsv coincheck", () => {
  it("業界標準フォーマットの買い/売りを解析する", () => {
    const csv = [
      "id,time,operation,amount,trading_currency,price,original_currency,fee,comment",
      "1,2026-01-15 10:00:00,buy,0.5,BTC,2500000,JPY,0,",
      "2,2026-03-01 09:30:00,sell,0.2,BTC,1200000,JPY,50,",
    ].join("\n");

    const result = parseExchangeCryptoCsv("coincheck", csv);
    expect(result.skippedRows).toEqual([]);
    expect(result.rows).toHaveLength(2);

    const [buy, sell] = result.rows;
    expect(buy.type).toBe("BUY");
    expect(buy.symbol).toBe("BTC");
    expect(buy.quantity.toNumber()).toBe(0.5);
    expect(buy.unitPriceJpy.toNumber()).toBe(5000000);

    expect(sell.type).toBe("SELL");
    expect(sell.unitPriceJpy.toNumber()).toBe(6000000);
    expect(sell.feeJpy.toNumber()).toBe(50);
  });

  it("入出金・暗号資産建て取引はスキップする", () => {
    const csv = [
      "id,time,operation,amount,trading_currency,price,original_currency,fee,comment",
      "1,2026-01-15 10:00:00,deposit,100000,JPY,100000,JPY,0,",
      "2,2026-01-16 10:00:00,buy,1,ETH,0.05,BTC,0,",
    ].join("\n");

    const result = parseExchangeCryptoCsv("coincheck", csv);
    expect(result.rows).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(2);
  });

  it("必須カラムが欠けている場合はエラーを投げる", () => {
    expect(() => parseExchangeCryptoCsv("coincheck", "id,time\n1,2026-01-01")).toThrow();
  });
});

describe("parseExchangeCryptoCsv bitflyer", () => {
  it("円建ての現物取引を解析する", () => {
    const csv = [
      "取引日時,通貨,取引種別,取引価格,通貨1,通貨1数量,手数料,通貨1の対円レート,通貨2,通貨2数量,自己・媒介,注文ID,備考",
      "2026/02/10 12:00:00,BTC/JPY,買い,5000000,BTC,0.1,0,5000000,JPY,500000,自己,abc,",
      "2026/02/11 13:00:00,BTC/JPY,売り,5100000,BTC,0.05,0,5100000,JPY,255000,自己,def,",
    ].join("\n");

    const result = parseExchangeCryptoCsv("bitflyer", csv);
    expect(result.skippedRows).toEqual([]);
    expect(result.rows).toHaveLength(2);

    const [buy, sell] = result.rows;
    expect(buy.type).toBe("BUY");
    expect(buy.symbol).toBe("BTC");
    expect(buy.unitPriceJpy.toNumber()).toBe(5000000);
    expect(sell.type).toBe("SELL");
    expect(sell.quantity.toNumber()).toBe(0.05);
  });

  it("英語ヘッダーにも対応する", () => {
    const csv = [
      "Trade Date,Product,Trade Type,Traded Price,Currency 1,Amount(Currency 1),Fee,JPY Rate,Currency 2,Amount(Currency 2)",
      "2026/02/10 12:00:00,BTC/JPY,Buy,5000000,BTC,0.1,0,5000000,JPY,500000",
    ].join("\n");

    const result = parseExchangeCryptoCsv("bitflyer", csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].type).toBe("BUY");
  });

  it("必須カラムが欠けている場合はエラーを投げる", () => {
    expect(() => parseExchangeCryptoCsv("bitflyer", "通貨,備考\nBTC/JPY,memo")).toThrow();
  });
});

describe("parseExchangeCryptoCsv gmo_coin", () => {
  it("現物取引の行のみを解析し、レバレッジ・入出金はスキップする", () => {
    const csv = [
      "日時,精算区分,日本円受渡金額,注文ID,約定ID,建玉ID,銘柄名,注文タイプ,取引区分,売買区分,執行条件,約定数量,約定レート,約定金額,注文手数料,レバレッジ手数料,入出金区分,入出金金額,授受区分,数量,送付手数料,送付先/送付元,トランザクションID",
      "2026/04/01 09:00:00,,,,,,BTC,指値,現物,BUY,指値,0.3,5000000,1500000,100,,,,,,,",
      "2026/04/02 09:00:00,,,,,,BTC_JPY,成行,レバレッジ,SELL,成行,0.1,5100000,510000,50,,,,,,,",
      "2026/04/03 09:00:00,,,,,,,,,,,,,,,,入金,100000,,,,,",
    ].join("\n");

    const result = parseExchangeCryptoCsv("gmo_coin", csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].symbol).toBe("BTC");
    expect(result.rows[0].type).toBe("BUY");
    expect(result.rows[0].quantity.toNumber()).toBe(0.3);
    expect(result.rows[0].feeJpy.toNumber()).toBe(100);
    expect(result.skippedRows).toHaveLength(2);
  });

  it("必須カラムが欠けている場合はエラーを投げる", () => {
    expect(() => parseExchangeCryptoCsv("gmo_coin", "日時,銘柄名\n2026/01/01,BTC")).toThrow();
  });
});
