import { describe, expect, it } from "vitest";
import { parseBrokerAnnualReportCsv, type AnnualReportCsvMapping } from "./annualReportCsv";

const MAPPING: AnnualReportCsvMapping = {
  brokerColumn: "証券会社",
  accountTypeColumn: "口座区分",
  proceedsColumn: "譲渡の対価の額",
  acquisitionCostColumn: "取得費及び譲渡費用の額等",
  dividendColumn: "配当等の額",
};

const CSV = [
  "証券会社,口座区分,譲渡の対価の額,取得費及び譲渡費用の額等,配当等の額",
  "SBI証券,特定口座(源泉徴収あり),1000000,800000,5000",
  "楽天証券,一般口座,200000,250000,",
].join("\n");

describe("parseBrokerAnnualReportCsv", () => {
  it("証券会社・口座区分ごとの年間サマリーを取り込む", () => {
    const { rows, skippedRows } = parseBrokerAnnualReportCsv(CSV, MAPPING);

    expect(skippedRows).toEqual([]);
    expect(rows).toHaveLength(2);

    expect(rows[0].broker).toBe("SBI証券");
    expect(rows[0].accountType).toBe("SPECIFIC_WITHHOLDING");
    expect(rows[0].proceedsJpy.toNumber()).toBe(1_000_000);
    expect(rows[0].acquisitionCostJpy.toNumber()).toBe(800_000);
    expect(rows[0].dividendJpy.toNumber()).toBe(5_000);

    expect(rows[1].broker).toBe("楽天証券");
    expect(rows[1].accountType).toBe("GENERAL");
    // 配当等の額が空欄の場合は0として扱う
    expect(rows[1].dividendJpy.toNumber()).toBe(0);
  });

  it("口座区分の表記ゆれを吸収する", () => {
    const csv = [
      "証券会社,口座区分,譲渡の対価の額,取得費及び譲渡費用の額等",
      "A証券,源泉徴収あり,100,50",
      "B証券,特定(源泉徴収なし),100,50",
      "C証券,一般,100,50",
    ].join("\n");

    const { rows, skippedRows } = parseBrokerAnnualReportCsv(csv, {
      brokerColumn: "証券会社",
      accountTypeColumn: "口座区分",
      proceedsColumn: "譲渡の対価の額",
      acquisitionCostColumn: "取得費及び譲渡費用の額等",
    });

    expect(skippedRows).toEqual([]);
    expect(rows.map((r) => r.accountType)).toEqual([
      "SPECIFIC_WITHHOLDING",
      "SPECIFIC_NO_WITHHOLDING",
      "GENERAL",
    ]);
  });

  it("必須項目が空、または口座区分・金額を解釈できない行はスキップして処理を続ける", () => {
    const csv = [
      "証券会社,口座区分,譲渡の対価の額,取得費及び譲渡費用の額等",
      ",特定口座(源泉徴収あり),100,50",
      "A証券,不明な口座,100,50",
      "A証券,特定口座(源泉徴収あり),不正な数値,50",
      "A証券,特定口座(源泉徴収あり),100,不正な数値",
      "A証券,特定口座(源泉徴収あり),100,50",
    ].join("\n");

    const { rows, skippedRows } = parseBrokerAnnualReportCsv(csv, {
      brokerColumn: "証券会社",
      accountTypeColumn: "口座区分",
      proceedsColumn: "譲渡の対価の額",
      acquisitionCostColumn: "取得費及び譲渡費用の額等",
    });

    expect(rows).toHaveLength(1);
    expect(skippedRows).toHaveLength(4);
    expect(skippedRows[1].reason).toMatch(/口座区分/);
    expect(skippedRows[2].reason).toMatch(/譲渡の対価の額/);
    expect(skippedRows[3].reason).toMatch(/取得費及び譲渡費用の額等/);
  });

  it("指定した列名がCSVに存在しない場合はエラーを投げる", () => {
    expect(() =>
      parseBrokerAnnualReportCsv(CSV, { ...MAPPING, brokerColumn: "存在しない列" }),
    ).toThrow(/証券会社/);
  });

  it("空のCSVは空の結果を返す", () => {
    const { rows, skippedRows } = parseBrokerAnnualReportCsv("", MAPPING);
    expect(rows).toEqual([]);
    expect(skippedRows).toEqual([]);
  });
});
