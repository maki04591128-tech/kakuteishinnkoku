import { describe, expect, it } from "vitest";
import { parseExchangeCsv } from "./exchangeCsv";

describe("parseExchangeCsv - bitflyer", () => {
  const header =
    "取引日時,通貨,取引種別,取引価格,通貨1,通貨1数量,手数料,通貨1の対円レート,通貨2,通貨2数量,自己・媒介,注文ID,備考";

  it("買い/売りの行を取り込み、手数料を円換算する", () => {
    const csv = [
      header,
      "2024/03/01 10:00:00,BTC_JPY,買い,5000000,BTC,0.1,0,5000000,JPY,500000,媒介,ORDER1,",
      "2024/06/01 12:00:00,BTC_JPY,売り,6000000,BTC,0.05,0.0001,6000000,JPY,300000,媒介,ORDER2,",
    ].join("\n");

    const { rows, skippedRows } = parseExchangeCsv("bitflyer", csv);
    expect(skippedRows).toHaveLength(0);
    expect(rows).toHaveLength(2);

    expect(rows[0].type).toBe("BUY");
    expect(rows[0].symbol).toBe("BTC");
    expect(rows[0].quantity.toString()).toBe("0.1");
    expect(rows[0].unitPriceJpy.toString()).toBe("5000000");
    expect(rows[0].feeJpy.toString()).toBe("0");

    expect(rows[1].type).toBe("SELL");
    // 手数料0.0001 BTC * 対円レート6,000,000円 = 600円
    expect(rows[1].feeJpy.toString()).toBe("600");
  });

  it("買い/売り以外の取引種別はスキップする", () => {
    const csv = [
      header,
      "2024/03/01 10:00:00,BTC,入金,0,BTC,0.1,0,5000000,JPY,0,,ORDER3,",
    ].join("\n");

    const { rows, skippedRows } = parseExchangeCsv("bitflyer", csv);
    expect(rows).toHaveLength(0);
    expect(skippedRows).toHaveLength(1);
    expect(skippedRows[0].reason).toContain("対象外");
  });

  it("必須カラムが無い場合はエラーを投げる", () => {
    expect(() => parseExchangeCsv("bitflyer", "a,b,c\n1,2,3")).toThrow();
  });
});

describe("parseExchangeCsv - coincheck (業界標準フォーマット)", () => {
  const header =
    "取引日時,取引種別,取引形態,通貨ペア,増加通貨名,増加数量,減少通貨名,減少数量,約定代金,約定価格,手数料通貨,手数料数量,送付元アドレス,送付先アドレス,登録番号,社名,備考";

  it("BTC購入(JPY減少・BTC増加)をBUYとして取り込む", () => {
    const csv = [
      header,
      "2024/01/10 09:00:00,取引,現物,btc_jpy,BTC,0.2,JPY,1000000,1000000,5000000,,,,,,,",
    ].join("\n");

    const { rows, skippedRows } = parseExchangeCsv("coincheck", csv);
    expect(skippedRows).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "BUY", symbol: "BTC" });
    expect(rows[0].quantity.toString()).toBe("0.2");
    expect(rows[0].unitPriceJpy.toString()).toBe("5000000");
  });

  it("BTC売却(BTC減少・JPY増加)をSELLとして取り込む", () => {
    const csv = [
      header,
      "2024/02/10 09:00:00,取引,現物,btc_jpy,JPY,600000,BTC,0.1,600000,6000000,,,,,,,",
    ].join("\n");

    const { rows } = parseExchangeCsv("coincheck", csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "SELL", symbol: "BTC" });
    expect(rows[0].quantity.toString()).toBe("0.1");
  });

  it("暗号資産同士の交換をTRADE_OUT/TRADE_INの2行として取り込む", () => {
    const csv = [
      header,
      "2024/03/10 09:00:00,取引,現物,eth_btc,ETH,1,BTC,0.05,300000,,,,,,,,",
    ].join("\n");

    const { rows, skippedRows } = parseExchangeCsv("coincheck", csv);
    expect(skippedRows).toHaveLength(0);
    expect(rows).toHaveLength(2);
    const tradeOut = rows.find((r) => r.type === "TRADE_OUT")!;
    const tradeIn = rows.find((r) => r.type === "TRADE_IN")!;
    expect(tradeOut.symbol).toBe("BTC");
    expect(tradeOut.quantity.toString()).toBe("0.05");
    expect(tradeIn.symbol).toBe("ETH");
    expect(tradeIn.quantity.toString()).toBe("1");
  });

  it("送付元・送付先アドレスがある行(入出金)はスキップする", () => {
    const csv = [
      header,
      "2024/04/10 09:00:00,送付,現物,,,,,BTC,0.1,,,,,0x1234,,,",
    ].join("\n");

    const { rows, skippedRows } = parseExchangeCsv("coincheck", csv);
    expect(rows).toHaveLength(0);
    expect(skippedRows).toHaveLength(1);
    expect(skippedRows[0].reason).toContain("入出金");
  });

  it("増加のみ・減少のみの行はスキップする", () => {
    const csv = [
      header,
      "2024/05/10 09:00:00,報酬,現物,,BTC,0.001,,,,,,,,,,,",
    ].join("\n");

    const { rows, skippedRows } = parseExchangeCsv("coincheck", csv);
    expect(rows).toHaveLength(0);
    expect(skippedRows).toHaveLength(1);
  });
});

describe("parseExchangeCsv - GMOコイン", () => {
  const header =
    "日時,精算区分,日本円受渡金額,注文ID,約定ID,建玉ID,銘柄名,注文タイプ,取引区分,売買区分,執行条件,約定数量,約定レート,約定金額,注文手数料,レバレッジ手数料,入出金区分,入出金金額,授受区分,数量,送付手数料,送付先/送付元,トランザクションID";

  it("現物の買い/売りを取り込む", () => {
    const csv = [
      header,
      "2024/01/05 08:00:00,,,ORD1,EXE1,,BTC,指値,現物,買,,0.1,5000000,500000,0,,,,,,,,",
      "2024/02/05 08:00:00,,,ORD2,EXE2,,BTC,成行,現物,売,,0.05,6000000,300000,0,,,,,,,,",
    ].join("\n");

    const { rows, skippedRows } = parseExchangeCsv("gmo", csv);
    expect(skippedRows).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ type: "BUY", symbol: "BTC" });
    expect(rows[1]).toMatchObject({ type: "SELL", symbol: "BTC" });
  });

  it("現物以外(証拠金・入出金)の行はスキップする", () => {
    const csv = [
      header,
      "2024/01/05 08:00:00,,,ORD3,EXE3,POS1,BTC_JPY,指値,レバレッジ,買,,0.1,5000000,500000,0,,,,,,,,",
      "2024/01/06 08:00:00,,,,,,,,,,,,,,,,入金,10000,,,,,",
    ].join("\n");

    const { rows, skippedRows } = parseExchangeCsv("gmo", csv);
    expect(rows).toHaveLength(0);
    expect(skippedRows).toHaveLength(2);
  });

  it("必須カラムが無い場合はエラーを投げる", () => {
    expect(() => parseExchangeCsv("gmo", "a,b\n1,2")).toThrow();
  });
});
