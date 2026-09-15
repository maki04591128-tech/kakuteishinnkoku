import { describe, expect, it } from "vitest";
import { parseCryptoExchangeCsv } from "./exchangeCsv";

describe("parseCryptoExchangeCsv", () => {
  it("bitFlyer風(通貨ペア・約定レート)のCSVを解析する", () => {
    const csv = [
      "約定日時,商品,売買,約定数量,約定レート,手数料",
      "2026/1/10 12:00:00,BTC_JPY,買い,0.1,5000000,0",
      "2026/3/5 09:30:00,BTC_JPY,売り,0.05,6000000,100",
    ].join("\n");

    const result = parseCryptoExchangeCsv(csv);
    expect(result.skippedRows).toEqual([]);
    expect(result.rows).toHaveLength(2);

    const [buy, sell] = result.rows;
    expect(buy.symbol).toBe("BTC");
    expect(buy.type).toBe("BUY");
    expect(buy.quantity.toNumber()).toBe(0.1);
    expect(buy.unitPriceJpy.toNumber()).toBe(5000000);

    expect(sell.type).toBe("SELL");
    expect(sell.feeJpy.toNumber()).toBe(100);
  });

  it("Coincheck風(通貨のみ・合計金額から単価を逆算)のCSVを解析する", () => {
    const csv = [
      "日時,通貨,取引種別,数量,合計金額,手数料",
      "2026/2/1 10:00:00,BTC,購入,0.2,1000000,0",
    ].join("\n");

    const result = parseCryptoExchangeCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].symbol).toBe("BTC");
    expect(result.rows[0].unitPriceJpy.toNumber()).toBe(5000000);
  });

  it("GMOコイン風(取引区分・約定代金)のCSVを解析する", () => {
    const csv = [
      "約定日時,銘柄,取引区分,約定数量,約定代金,手数料",
      "2026/4/1 15:00:00,ETH_JPY,売,1.5,450000,50",
    ].join("\n");

    const result = parseCryptoExchangeCsv(csv);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.symbol).toBe("ETH");
    expect(row.type).toBe("SELL");
    expect(row.unitPriceJpy.toNumber()).toBe(300000);
    expect(row.feeJpy.toNumber()).toBe(50);
  });

  it("円建て以外の通貨ペアはスキップする", () => {
    const csv = [
      "約定日時,商品,売買,約定数量,約定レート",
      "2026/1/1 00:00:00,ETH_BTC,買い,1,0.05",
    ].join("\n");

    const result = parseCryptoExchangeCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].reason).toMatch(/円建て以外/);
  });

  it("入出金など取引以外の行はスキップする", () => {
    const csv = [
      "約定日時,商品,売買,約定数量,約定レート",
      "2026/1/1 00:00:00,BTC_JPY,入金,1,5000000",
    ].join("\n");

    const result = parseCryptoExchangeCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.skippedRows[0].reason).toMatch(/入出金/);
  });

  it("壊れた行はスキップし、正常な行の処理は継続する", () => {
    const csv = [
      "約定日時,商品,売買,約定数量,約定レート",
      "invalid-date,BTC_JPY,買い,1,5000000",
      "2026/1/1 00:00:00,BTC_JPY,買い,not-a-number,5000000",
      "2026/1/2 00:00:00,BTC_JPY,買い,1,5000000",
    ].join("\n");

    const result = parseCryptoExchangeCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.skippedRows).toHaveLength(2);
  });

  it("必須カラムが欠けている場合はエラーを投げる", () => {
    expect(() =>
      parseCryptoExchangeCsv("商品,約定レート\nBTC_JPY,5000000"),
    ).toThrow();
  });

  it("単価・合計金額のいずれのカラムも無い場合はエラーを投げる", () => {
    expect(() =>
      parseCryptoExchangeCsv("約定日時,商品,売買,約定数量\n2026/1/1,BTC_JPY,買い,1"),
    ).toThrow();
  });

  it("列の並び順が変わっても解析できる", () => {
    const reordered = [
      "数量,約定レート,日時,通貨,取引種別",
      "0.3,4000000,2026/5/1,BTC,買い",
    ].join("\n");

    const result = parseCryptoExchangeCsv(reordered);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].symbol).toBe("BTC");
  });
});
