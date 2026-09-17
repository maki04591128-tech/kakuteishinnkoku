import { describe, expect, it } from "vitest";
import {
  COMMON_EXCHANGE_CSV_HEADER_NAMES,
  COMMON_EXCHANGE_CSV_TRADE_TYPE_VALUES,
  parseCryptoExchangeCsv,
  parseExchangeCsv,
  type ExchangeCsvMapping,
} from "./exchangeCsv";

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
    expect(rows[1].feeJpy.toString()).toBe("600");
  });

  it("買い/売り以外の取引種別はスキップする", () => {
    const csv = [header, '2024/03/01 10:00:00,BTC,入金,0,BTC,0.1,0,5000000,JPY,0,,ORDER3,'].join(
      "\n",
    );

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
    const tradeOut = rows.find((row) => row.type === "TRADE_OUT")!;
    const tradeIn = rows.find((row) => row.type === "TRADE_IN")!;
    expect(tradeOut.symbol).toBe("BTC");
    expect(tradeOut.quantity.toString()).toBe("0.05");
    expect(tradeIn.symbol).toBe("ETH");
    expect(tradeIn.quantity.toString()).toBe("1");
  });

  it("送付元・送付先アドレスがある行(入出金)はスキップする", () => {
    const csv = [header, "2024/04/10 09:00:00,送付,現物,,,,,BTC,0.1,,,,,0x1234,,,"].join("\n");

    const { rows, skippedRows } = parseExchangeCsv("coincheck", csv);
    expect(rows).toHaveLength(0);
    expect(skippedRows).toHaveLength(1);
    expect(skippedRows[0].reason).toContain("入出金");
  });

  it("増加のみ・減少のみの行はスキップする", () => {
    const csv = [header, "2024/05/10 09:00:00,報酬,現物,,BTC,0.001,,,,,,,,,,,"].join("\n");

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

describe("parseExchangeCsv - bitbank", () => {
  const header =
    "注文id,取引id,通貨ペア,現物/信用,タイプ,売/買,数量,価格,実現損益,発生手数料,実現手数料,実現利息,m/t,取引日時";

  it("現物の買い/売りを取り込む", () => {
    const csv = [
      header,
      "1,1,btc_jpy,現物,指値,買,0.1,5000000,,0,0,,taker,2024/01/05 08:00:00",
      "2,2,btc_jpy,現物,成行,売,0.05,6000000,,300,300,,taker,2024/02/05 08:00:00",
    ].join("\n");

    const { rows, skippedRows } = parseExchangeCsv("bitbank", csv);
    expect(skippedRows).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ type: "BUY", symbol: "BTC" });
    expect(rows[0].feeJpy.toString()).toBe("0");
    expect(rows[1]).toMatchObject({ type: "SELL", symbol: "BTC" });
    expect(rows[1].feeJpy.toString()).toBe("300");
  });

  it("信用取引の行はスキップする", () => {
    const csv = [
      header,
      "3,3,btc_jpy,信用,指値,買,0.1,5000000,0,500,500,0,taker,2024/01/05 08:00:00",
    ].join("\n");

    const { rows, skippedRows } = parseExchangeCsv("bitbank", csv);
    expect(rows).toHaveLength(0);
    expect(skippedRows).toHaveLength(1);
    expect(skippedRows[0].reason).toContain("信用取引");
  });

  it("メイカー報酬(マイナス手数料)は0円として扱う", () => {
    const csv = [
      header,
      "4,4,btc_jpy,現物,指値,買,0.1,5000000,,-50,-50,,maker,2024/01/05 08:00:00",
    ].join("\n");

    const { rows } = parseExchangeCsv("bitbank", csv);
    expect(rows[0].feeJpy.toString()).toBe("0");
  });

  it("必須カラムが無い場合はエラーを投げる", () => {
    expect(() => parseExchangeCsv("bitbank", "a,b\n1,2")).toThrow();
  });
});

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
    expect(result.rows[0].symbol).toBe("BTC");
    expect(result.rows[0].type).toBe("BUY");
    expect(result.rows[1].feeJpy.toNumber()).toBe(100);
  });

  it("Coincheck風(通貨のみ・合計金額から単価を逆算)のCSVを解析する", () => {
    const csv = ["日時,通貨,取引種別,数量,合計金額,手数料", "2026/2/1 10:00:00,BTC,購入,0.2,1000000,0"].join(
      "\n",
    );

    const result = parseCryptoExchangeCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].unitPriceJpy.toNumber()).toBe(5000000);
  });
});

describe("parseExchangeCsv - preset『other』(自動認識フォールバック)", () => {
  it("よく使われる列見出しのCSVは手動マッピング無しでも自動認識して取り込める", () => {
    const csv = [
      "約定日時,商品,売買,約定数量,約定レート,手数料",
      "2026/1/10 12:00:00,BTC_JPY,買い,0.1,5000000,0",
      "2026/3/5 09:30:00,BTC_JPY,売り,0.05,6000000,100",
    ].join("\n");

    const result = parseExchangeCsv("other", csv);
    expect(result.skippedRows).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].symbol).toBe("BTC");
    expect(result.rows[0].type).toBe("BUY");
  });

  it("自動認識できない列見出しの場合は手動マッピングへ誘導するエラーを投げる", () => {
    const csv = ["foo,bar,baz", "1,2,3"].join("\n");
    expect(() => parseExchangeCsv("other", csv)).toThrow(/マッピング欄/);
  });
});

describe("parseExchangeCsv - manual mapping", () => {
  it("Coincheck業界標準フォーマットのbuy/sellを取り込み、それ以外はスキップする", () => {
    const result = parseExchangeCsv(COINCHECK_CSV, COINCHECK_MAPPING);
    expect(result.rows).toHaveLength(2);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].lineNumber).toBe(4);
    expect(result.rows[0].type).toBe("BUY");
    expect(result.rows[1].type).toBe("SELL");
  });

  it("bitFlyer形式の列指定でも買い/売りを取り込み、非対応の取引種別はスキップする", () => {
    const result = parseExchangeCsv(BITFLYER_CSV, BITFLYER_MAPPING);
    expect(result.rows).toHaveLength(2);
    expect(result.skippedRows).toHaveLength(1);
    expect(result.skippedRows[0].reason).toContain("入金");
    expect(result.rows[1].feeJpy.toNumber()).toBe(100);
  });

  it("指定した列名がCSVに存在しない場合はエラーを投げる", () => {
    expect(() =>
      parseExchangeCsv("a,b,c\n1,2,3", { ...COINCHECK_MAPPING, dateColumn: "存在しない列" }),
    ).toThrow(/存在しない列/);
  });

  it("壊れた行はスキップし処理を継続する", () => {
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

  it("自動認識に失敗した場合、不足カラムを内部キーではなく日本語ラベルで報告する", () => {
    expect(() => parseCryptoExchangeCsv("foo,bar\n1,2")).toThrow(
      "不足しているカラム: 日時, 銘柄・通貨ペア, 売買種別, 数量",
    );
  });
});

describe("COMMON_EXCHANGE_CSV_HEADER_NAMES / COMMON_EXCHANGE_CSV_TRADE_TYPE_VALUES(手動マッピングの入力補助)", () => {
  it("各項目によく使われる列見出しの候補を含む(自動認識と同じ一覧)", () => {
    expect(COMMON_EXCHANGE_CSV_HEADER_NAMES.date).toEqual(
      expect.arrayContaining(["取引日時", "日時", "日付", "Date"]),
    );
    expect(COMMON_EXCHANGE_CSV_HEADER_NAMES.pair).toEqual(
      expect.arrayContaining(["銘柄", "通貨ペア", "Pair"]),
    );
    expect(COMMON_EXCHANGE_CSV_HEADER_NAMES.side).toEqual(
      expect.arrayContaining(["売買", "取引種別", "Side"]),
    );
    expect(COMMON_EXCHANGE_CSV_HEADER_NAMES.quantity).toEqual(
      expect.arrayContaining(["約定数量", "数量", "Quantity"]),
    );
    expect(COMMON_EXCHANGE_CSV_HEADER_NAMES.unitPrice).toEqual(
      expect.arrayContaining(["約定単価", "単価", "Price"]),
    );
    expect(COMMON_EXCHANGE_CSV_HEADER_NAMES.fee).toEqual(
      expect.arrayContaining(["手数料", "Fee"]),
    );
    // 単価とは別項目のため、合計金額専用の列見出しは単価の候補には含まれない
    expect(COMMON_EXCHANGE_CSV_HEADER_NAMES.unitPrice).not.toContain("約定代金");
  });

  it("候補の列見出しは実際に対応する項目として自動認識できる(候補一覧と実装の乖離を防ぐ)", () => {
    for (const header of COMMON_EXCHANGE_CSV_HEADER_NAMES.date) {
      const csv = [`${header},銘柄,売買,数量,単価`, "2026/1/1,BTC,買い,1,5000000"].join("\n");
      const result = parseCryptoExchangeCsv(csv);
      expect(result.skippedRows).toHaveLength(0);
    }
  });

  it("「買い」「売り」を表す値の候補を含み、実際にBUY/SELLとして解釈できる", () => {
    expect(COMMON_EXCHANGE_CSV_TRADE_TYPE_VALUES.buy).toEqual(expect.arrayContaining(["買い"]));
    expect(COMMON_EXCHANGE_CSV_TRADE_TYPE_VALUES.sell).toEqual(expect.arrayContaining(["売り"]));

    for (const value of COMMON_EXCHANGE_CSV_TRADE_TYPE_VALUES.buy) {
      const csv = ["日時,銘柄,売買,数量,単価", `2026/1/1,BTC,${value},1,5000000`].join("\n");
      expect(parseCryptoExchangeCsv(csv).rows[0]?.type).toBe("BUY");
    }
    for (const value of COMMON_EXCHANGE_CSV_TRADE_TYPE_VALUES.sell) {
      const csv = ["日時,銘柄,売買,数量,単価", `2026/1/1,BTC,${value},1,5000000`].join("\n");
      expect(parseCryptoExchangeCsv(csv).rows[0]?.type).toBe("SELL");
    }
  });
});
