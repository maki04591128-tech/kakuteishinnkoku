import { describe, expect, it } from "vitest";
import { parseFuturesCsv, type FuturesCsvMapping } from "./futuresCsv";

const MAPPING: FuturesCsvMapping = {
  dateColumn: "決済日時",
  symbolColumn: "通貨ペア",
  pnlColumn: "損益",
  feeColumn: "手数料",
  swapColumn: "スワップ",
};

const CSV = [
  "決済日時,通貨ペア,損益,手数料,スワップ",
  "2026/1/10 10:00:00,USD/JPY,100000,500,-100",
  "2026/3/5 12:30:00,USD/JPY,-30000,500,50",
  "2026/4/1 09:00:00,EUR/JPY,20000,,",
].join("\n");

describe("parseFuturesCsv", () => {
  it("決済損益(負の値含む)・手数料・スワップを取り込む", () => {
    const { rows, skippedRows } = parseFuturesCsv(CSV, MAPPING);

    expect(skippedRows).toEqual([]);
    expect(rows).toHaveLength(3);
    expect(rows[0].symbol).toBe("USD/JPY");
    expect(rows[0].realizedPnlJpy.toNumber()).toBe(100_000);
    expect(rows[0].feeJpy.toNumber()).toBe(500);
    expect(rows[0].swapJpy.toNumber()).toBe(-100);

    expect(rows[1].realizedPnlJpy.toNumber()).toBe(-30_000);

    // 手数料・スワップ列が空欄の行は0として扱う
    expect(rows[2].feeJpy.toNumber()).toBe(0);
    expect(rows[2].swapJpy.toNumber()).toBe(0);
  });

  it("必須項目が空の行はスキップして処理を続ける", () => {
    const csv = [
      "決済日時,通貨ペア,損益",
      "2026/1/10 10:00:00,USD/JPY,",
      ",USD/JPY,1000",
      "2026/1/11 10:00:00,EUR/JPY,5000",
    ].join("\n");

    const { rows, skippedRows } = parseFuturesCsv(csv, {
      dateColumn: "決済日時",
      symbolColumn: "通貨ペア",
      pnlColumn: "損益",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].symbol).toBe("EUR/JPY");
    expect(skippedRows).toHaveLength(2);
  });

  it("解釈できない日付・決済損益はスキップして理由を報告する", () => {
    const csv = [
      "決済日時,通貨ペア,損益",
      "不正な日付,USD/JPY,1000",
      "2026/1/11 10:00:00,EUR/JPY,不正な数値",
    ].join("\n");

    const { rows, skippedRows } = parseFuturesCsv(csv, {
      dateColumn: "決済日時",
      symbolColumn: "通貨ペア",
      pnlColumn: "損益",
    });

    expect(rows).toHaveLength(0);
    expect(skippedRows[0].reason).toMatch(/決済日時/);
    expect(skippedRows[1].reason).toMatch(/決済損益/);
  });

  it("指定した列名がCSVに存在しない場合はエラーを投げる", () => {
    expect(() =>
      parseFuturesCsv(CSV, { ...MAPPING, dateColumn: "存在しない列" }),
    ).toThrow(/決済日時/);
  });

  it("空のCSVは空の結果を返す", () => {
    const { rows, skippedRows } = parseFuturesCsv("", MAPPING);
    expect(rows).toEqual([]);
    expect(skippedRows).toEqual([]);
  });
});
