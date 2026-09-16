import { describe, expect, it } from "vitest";
import { parseGmoCoinCsv } from "./gmoCoin";

const HEADER = [
  "日時",
  "精算区分",
  "日本円受渡金額",
  "注文ID",
  "約定ID",
  "建玉ID",
  "銘柄名",
  "注文タイプ",
  "取引区分",
  "売買区分",
  "執行条件",
  "約定数量",
  "約定レート",
  "約定金額",
  "注文手数料",
  "レバレッジ手数料",
  "入出金区分",
  "入出金金額",
  "授受区分",
  "数量",
  "送付手数料",
  "送付先/送付元",
  "トランザクションID",
].join(",");

function row(overrides: Partial<Record<string, string>> = {}): string {
  const defaults: Record<string, string> = {
    日時: "2026/01/10 10:00:00",
    精算区分: "",
    日本円受渡金額: "",
    注文ID: "1",
    約定ID: "1",
    建玉ID: "",
    銘柄名: "BTC",
    注文タイプ: "指値",
    取引区分: "現物",
    売買区分: "買",
    執行条件: "指値",
    約定数量: "0.1",
    約定レート: "5000000",
    約定金額: "500000",
    注文手数料: "0",
    レバレッジ手数料: "",
    入出金区分: "",
    入出金金額: "",
    授受区分: "",
    数量: "",
    送付手数料: "",
    "送付先/送付元": "",
    トランザクションID: "",
  };
  const merged = { ...defaults, ...overrides };
  return HEADER.split(",")
    .map((h) => merged[h])
    .join(",");
}

describe("parseGmoCoinCsv", () => {
  it("現物の買い注文を解析する", () => {
    const csv = [HEADER, row()].join("\n");
    const result = parseGmoCoinCsv(csv);

    expect(result.skippedRows).toEqual([]);
    expect(result.rows).toHaveLength(1);
    const [r] = result.rows;
    expect(r.symbol).toBe("BTC");
    expect(r.type).toBe("BUY");
    expect(r.quantity.toNumber()).toBe(0.1);
    expect(r.unitPriceJpy.toNumber()).toBe(5000000);
  });

  it("現物の売り注文を解析する", () => {
    const csv = [HEADER, row({ 売買区分: "売" })].join("\n");
    const result = parseGmoCoinCsv(csv);
    expect(result.rows[0].type).toBe("SELL");
  });

  it("レバレッジ取引はスキップする", () => {
    const csv = [HEADER, row({ 取引区分: "レバレッジ" })].join("\n");
    const result = parseGmoCoinCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.skippedRows[0].reason).toContain("現物取引以外");
  });

  it("入出金行(約定数量が空)はスキップする", () => {
    const csv = [
      HEADER,
      row({
        取引区分: "",
        売買区分: "",
        約定数量: "",
        約定レート: "",
        入出金区分: "入金",
        入出金金額: "100000",
      }),
    ].join("\n");
    const result = parseGmoCoinCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.skippedRows).toHaveLength(1);
  });

  it("銘柄名の_JPYサフィックスを取り除く", () => {
    const csv = [HEADER, row({ 銘柄名: "ETH_JPY" })].join("\n");
    const result = parseGmoCoinCsv(csv);
    expect(result.rows[0].symbol).toBe("ETH");
  });

  it("必須カラムが欠けている場合はエラーを投げる", () => {
    expect(() => parseGmoCoinCsv("銘柄名\nBTC")).toThrow();
  });
});
