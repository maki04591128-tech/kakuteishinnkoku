import { describe, expect, it } from "vitest";
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
  });
});
