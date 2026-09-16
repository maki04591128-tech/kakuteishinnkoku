import { describe, expect, it } from "vitest";
<<<<<<< HEAD
import { parseCoincheckStandardCsv } from "./coincheck";

const HEADER = "id,time,operation,amount,trading_currency,price,original_currency,fee,comment";

describe("parseCoincheckStandardCsv", () => {
  it("buy/sell行をCryptoTrade形式に変換する", () => {
    const csv = [
      HEADER,
      "1,2024-03-01 10:00:00,buy,0.1,BTC,5000000,JPY,0,",
      "2,2024-06-15 09:30:00,sell,0.05,BTC,6000000,JPY,10,メモ",
    ].join("\n");

    const result = parseCoincheckStandardCsv(csv);

    expect(result.skippedRows).toEqual([]);
    expect(result.rows).toHaveLength(2);

    expect(result.rows[0]).toMatchObject({ symbol: "BTC", type: "BUY", memo: null });
    expect(result.rows[0].quantity.toString()).toBe("0.1");
    expect(result.rows[0].unitPriceJpy.toString()).toBe("5000000");

    expect(result.rows[1]).toMatchObject({ symbol: "BTC", type: "SELL", memo: "メモ" });
    expect(result.rows[1].feeJpy.toString()).toBe("10");
  });

  it("buy/sell以外のoperationはスキップする", () => {
    const csv = [HEADER, "3,2024-03-01 10:00:00,deposit,0.1,BTC,0,JPY,0,"].join("\n");

    const result = parseCoincheckStandardCsv(csv);

    expect(result.rows).toEqual([]);
    expect(result.skippedRows[0].reason).toContain("未対応のoperation");
  });

  it("original_currencyがJPY以外の行はスキップする", () => {
    const csv = [HEADER, "4,2024-03-01 10:00:00,buy,0.1,BTC,3000,USD,0,"].join("\n");

    const result = parseCoincheckStandardCsv(csv);

    expect(result.rows).toEqual([]);
    expect(result.skippedRows[0].reason).toContain("JPY建て以外");
  });

  it("必須カラムが無いCSVはエラーにする", () => {
    expect(() => parseCoincheckStandardCsv("foo,bar\n1,2")).toThrow(
      /Coincheckの業界標準フォーマットCSVとして認識できませんでした/,
    );
=======
import { parseCoincheckCsv } from "./coincheck";

const HEADER =
  "取引日時,取引種別,取引形態,通貨ペア,増加通貨名,増加数量,減少通貨名,減少数量,約定価格/数量,単価,手数料通貨,手数料数量,送付元アドレス,送付先アドレス,登録番号,社名,備考";

describe("parseCoincheckCsv", () => {
  it("買い注文(JPY減少・BTC増加)を解析する", () => {
    const csv = [
      HEADER,
      "2026-01-10 10:00:00,取引,現物,btc_jpy,BTC,0.1,JPY,500000,,5000000,,,,,,,",
    ].join("\n");

    const result = parseCoincheckCsv(csv);
    expect(result.skippedRows).toEqual([]);
    expect(result.rows).toHaveLength(1);

    const [row] = result.rows;
    expect(row.symbol).toBe("BTC");
    expect(row.type).toBe("BUY");
    expect(row.quantity.toNumber()).toBe(0.1);
    expect(row.unitPriceJpy.toNumber()).toBe(5000000);
  });

  it("売り注文(BTC減少・JPY増加)を解析する", () => {
    const csv = [
      HEADER,
      "2026-01-10 10:00:00,取引,現物,btc_jpy,JPY,600000,BTC,0.1,,6000000,,,,,,,",
    ].join("\n");

    const result = parseCoincheckCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].type).toBe("SELL");
    expect(result.rows[0].symbol).toBe("BTC");
    expect(result.rows[0].quantity.toNumber()).toBe(0.1);
  });

  it("単価カラムが空の場合は増加額/減少額から単価を計算する", () => {
    const csv = [
      HEADER,
      "2026-01-10 10:00:00,取引,現物,btc_jpy,BTC,0.5,JPY,2500000,,,,,,,,,",
    ].join("\n");

    const result = parseCoincheckCsv(csv);
    expect(result.rows[0].unitPriceJpy.toNumber()).toBe(5000000);
  });

  it("暗号資産建ての手数料を単価で円換算する", () => {
    const csv = [
      HEADER,
      "2026-01-10 10:00:00,取引,現物,btc_jpy,BTC,0.1,JPY,500000,,5000000,BTC,0.0001,,,,,",
    ].join("\n");

    const result = parseCoincheckCsv(csv);
    expect(result.rows[0].feeJpy.toNumber()).toBe(500);
  });

  it("入出金など片側しか無い行はスキップする", () => {
    const csv = [HEADER, "2026-01-10 10:00:00,入金,入金,,JPY,100000,,,,,,,,,,,"].join("\n");

    const result = parseCoincheckCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
  });

  it("暗号資産同士の交換はスキップする", () => {
    const csv = [
      HEADER,
      "2026-01-10 10:00:00,取引,現物,eth_btc,ETH,1,BTC,0.05,,,,,,,,,",
    ].join("\n");

    const result = parseCoincheckCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.skippedRows[0].reason).toContain("暗号資産同士の交換");
  });

  it("必須カラムが欠けている場合はエラーを投げる", () => {
    expect(() => parseCoincheckCsv("通貨ペア\nbtc_jpy")).toThrow();
>>>>>>> origin/claude/wonderful-edison-xzm3zs
  });
});
