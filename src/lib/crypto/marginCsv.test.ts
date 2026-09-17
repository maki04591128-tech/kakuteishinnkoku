import { describe, expect, it } from "vitest";
import {
  COMMON_MARGIN_CSV_HEADER_NAMES,
  parseCryptoMarginCsv,
  type MarginCsvMapping,
} from "./marginCsv";

const MAPPING: MarginCsvMapping = {
  dateColumn: "決済日時",
  symbolColumn: "銘柄",
  pnlColumn: "決済損益",
  feeColumn: "手数料",
  swapColumn: "スワップ",
};

const CSV = [
  "決済日時,銘柄,決済損益,手数料,スワップ",
  "2026/1/10 10:00:00,BTC,100000,500,-100",
  "2026/3/5 12:30:00,BTC,-30000,500,50",
  "2026/4/1 09:00:00,ETH,20000,,",
].join("\n");

describe("parseCryptoMarginCsv", () => {
  it("決済損益(負の値含む)・手数料・スワップを取り込む", () => {
    const { rows, skippedRows } = parseCryptoMarginCsv(CSV, MAPPING);

    expect(skippedRows).toEqual([]);
    expect(rows).toHaveLength(3);
    expect(rows[0].symbol).toBe("BTC");
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
      "決済日時,銘柄,決済損益",
      "2026/1/10 10:00:00,BTC,",
      ",BTC,1000",
      "2026/1/11 10:00:00,ETH,5000",
    ].join("\n");

    const { rows, skippedRows } = parseCryptoMarginCsv(csv, {
      dateColumn: "決済日時",
      symbolColumn: "銘柄",
      pnlColumn: "決済損益",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].symbol).toBe("ETH");
    expect(skippedRows).toHaveLength(2);
  });

  it("解釈できない日付・決済損益はスキップして理由を報告する", () => {
    const csv = [
      "決済日時,銘柄,決済損益",
      "不正な日付,BTC,1000",
      "2026/1/11 10:00:00,ETH,不正な数値",
    ].join("\n");

    const { rows, skippedRows } = parseCryptoMarginCsv(csv, {
      dateColumn: "決済日時",
      symbolColumn: "銘柄",
      pnlColumn: "決済損益",
    });

    expect(rows).toHaveLength(0);
    expect(skippedRows[0].reason).toMatch(/決済日時/);
    expect(skippedRows[1].reason).toMatch(/決済損益/);
  });

  it("指定した列名がCSVに存在しない場合はエラーを投げる", () => {
    expect(() =>
      parseCryptoMarginCsv(CSV, { ...MAPPING, dateColumn: "存在しない列" }),
    ).toThrow(/決済日時/);
  });

  it("空のCSVは空の結果を返す", () => {
    const { rows, skippedRows } = parseCryptoMarginCsv("", MAPPING);
    expect(rows).toEqual([]);
    expect(skippedRows).toEqual([]);
  });
});

describe("COMMON_MARGIN_CSV_HEADER_NAMES", () => {
  it("各項目に手動マッピング欄の入力補助用の候補が1件以上ある", () => {
    for (const headers of Object.values(COMMON_MARGIN_CSV_HEADER_NAMES)) {
      expect(headers.length).toBeGreaterThan(0);
    }
  });

  it("候補の列名で実際にCSVを取り込める", () => {
    const csv = [
      "決済日時,銘柄名,建玉損益,決済手数料,スワップポイント",
      "2026/1/10 10:00:00,BTC,100000,500,-100",
    ].join("\n");

    const { rows, skippedRows } = parseCryptoMarginCsv(csv, {
      dateColumn: "決済日時",
      symbolColumn: "銘柄名",
      pnlColumn: "建玉損益",
      feeColumn: "決済手数料",
      swapColumn: "スワップポイント",
    });

    expect(skippedRows).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].realizedPnlJpy.toNumber()).toBe(100_000);
  });
});
