import { describe, expect, it } from "vitest";
import {
  parseCryptoExchangeCsv,
  parseExchangeCsv,
  type ExchangeCsvMapping,
} from "./exchangeCsv";

// Coincheck「業界標準フォーマット」を模したCSV
// (id,time,operation,amount,trading_currency,price,original_currency,fee,comment)
const COINCHECK_MAPPING: ExchangeCsvMapping = {
  dateColumn: "time",
  symbolColumn: "trading_currency",
  typeColumn: "operation",
  buyValue: "buy",
  sellValue: "sell",
  quantityColumn: "amount",
  unitPriceColumn: "price",
  feeColumn: "fee",
};

const COINCHECK_CSV = [
  "id,time,operation,amount,trading_currency,price,original_currency,fee,comment",
  "1,2026/1/10 10:00:00,buy,0.1,BTC,5000000,JPY,0,",
  "2,2026/3/5 12:30:00,sell,0.05,BTC,6000000,JPY,0,",
  "3,2026/4/1 09:00:00,deposit,1,JPY,1,JPY,0,入金",
].join("\n");

// bitFlyer現物取引履歴を模したCSV
// (取引日時,通貨,取引種別,取引価格,通貨1,通貨1数量,手数料,...)
const BITFLYER_MAPPING: ExchangeCsvMapping = {
  dateColumn: "取引日時",
  symbolColumn: "通貨1",
  typeColumn: "取引種別",
  buyValue: "買い",
  sellValue: "売り",
  quantityColumn: "通貨1数量",
  unitPriceColumn: "取引価格",
  feeColumn: "手数料",
};

const BITFLYER_CSV = [
  "取引日時,通貨,取引種別,取引価格,通貨1,通貨1数量,手数料",
  "2026/2/1 08:00:00,BTC/JPY,買い,5100000,BTC,0.2,0",
  "2026/2/15 08:00:00,BTC/JPY,売り,5300000,BTC,0.1,100",
  "2026/2/20 08:00:00,BTC/JPY,入金,0,BTC,0.5,0",
].join("\n");

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

describe("parseExchangeCsv", () => {
  it("Coincheck業界標準フォーマットのbuy/sellを取り込み、それ以外はスキップする", () => {
    const result = parseExchangeCsv(COINCHECK_CSV, COINCHECK_MAPPING);

    expect(result.rows).toHaveLength(2);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].lineNumber).toBe(4);

    const [buy, sell] = result.rows;
    expect(buy.type).toBe("BUY");
    expect(buy.symbol).toBe("BTC");
    expect(buy.quantity.toNumber()).toBe(0.1);
    expect(buy.unitPriceJpy.toNumber()).toBe(5000000);

    expect(sell.type).toBe("SELL");
    expect(sell.quantity.toNumber()).toBe(0.05);
  });

  it("bitFlyer形式の列指定でも買い/売りを取り込み、非対応の取引種別はスキップする", () => {
    const result = parseExchangeCsv(BITFLYER_CSV, BITFLYER_MAPPING);

    expect(result.rows).toHaveLength(2);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].reason).toContain("入金");

    const [buy, sell] = result.rows;
    expect(buy.type).toBe("BUY");
    expect(buy.unitPriceJpy.toNumber()).toBe(5100000);
    expect(sell.type).toBe("SELL");
    expect(sell.feeJpy.toNumber()).toBe(100);
  });

  it("指定した列名がCSVに存在しない場合はエラーを投げる", () => {
    const csv = ["a,b,c", "1,2,3"].join("\n");
    expect(() =>
      parseExchangeCsv(csv, { ...COINCHECK_MAPPING, dateColumn: "存在しない列" }),
    ).toThrow(/存在しない列/);
  });

  it("日付・数量・単価を解釈できない行はスキップし処理を継続する", () => {
    const csv = [
      "time,trading_currency,operation,amount,price",
      "invalid-date,BTC,buy,0.1,5000000",
      "2026/1/1,BTC,buy,not-a-number,5000000",
      "2026/1/1,BTC,buy,0.1,not-a-number",
      "2026/1/2,BTC,buy,0.1,5000000",
    ].join("\n");

    const mapping: ExchangeCsvMapping = {
      dateColumn: "time",
      symbolColumn: "trading_currency",
      typeColumn: "operation",
      buyValue: "buy",
      sellValue: "sell",
      quantityColumn: "amount",
      unitPriceColumn: "price",
    };

    const result = parseExchangeCsv(csv, mapping);
    expect(result.rows).toHaveLength(1);
    expect(result.skippedRows).toHaveLength(3);
  });

  it("数量・単価がマイナス表記でも絶対値として取り込む", () => {
    const csv = [
      "time,trading_currency,operation,amount,price",
      "2026/1/1,BTC,sell,-0.1,5000000",
    ].join("\n");
    const mapping: ExchangeCsvMapping = {
      dateColumn: "time",
      symbolColumn: "trading_currency",
      typeColumn: "operation",
      buyValue: "buy",
      sellValue: "sell",
      quantityColumn: "amount",
      unitPriceColumn: "price",
    };
    const result = parseExchangeCsv(csv, mapping);
    expect(result.rows[0].quantity.toNumber()).toBe(0.1);
  });
});
