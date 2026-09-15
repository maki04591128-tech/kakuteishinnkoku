import { describe, expect, it } from "vitest";
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
  });
});
