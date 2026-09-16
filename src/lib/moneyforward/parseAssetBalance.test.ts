import { describe, expect, it } from "vitest";
import { parseMoneyForwardAssetBalanceCsv, type AssetBalanceCsvMapping } from "./parseAssetBalance";

const MAPPING: AssetBalanceCsvMapping = {
  dateColumn: "日付",
  categoryColumn: "大分類",
  institutionColumn: "金融機関",
  assetNameColumn: "資産名",
  balanceColumn: "残高",
};

const CSV = [
  "日付,大分類,金融機関,資産名,残高",
  "2026/1/1,暗号資産,bitFlyer,ビットコイン,1500000",
  "2026/1/1,株式(現物),SBI証券,トヨタ自動車,300000",
  "2026/1/1,預金・現金,住信SBIネット銀行,普通預金,50000",
].join("\n");

describe("parseMoneyForwardAssetBalanceCsv", () => {
  it("金融機関・資産名・残高を取り込む", () => {
    const { rows, skippedRows } = parseMoneyForwardAssetBalanceCsv(CSV, MAPPING);

    expect(skippedRows).toEqual([]);
    expect(rows).toHaveLength(3);
    expect(rows[0].institution).toBe("bitFlyer");
    expect(rows[0].assetName).toBe("ビットコイン");
    expect(rows[0].category).toBe("暗号資産");
    expect(rows[0].balanceJpy.toNumber()).toBe(1_500_000);
    expect(rows[0].snapshotDate?.getFullYear()).toBe(2026);
  });

  it("日付列・大分類列を指定しない場合は snapshotDate=null / category=空文字 になる", () => {
    const csv = ["金融機関,資産名,残高", "bitFlyer,ビットコイン,1500000"].join("\n");
    const { rows } = parseMoneyForwardAssetBalanceCsv(csv, {
      institutionColumn: "金融機関",
      assetNameColumn: "資産名",
      balanceColumn: "残高",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].snapshotDate).toBeNull();
    expect(rows[0].category).toBe("");
  });

  it("必須項目が空の行はスキップして処理を続ける", () => {
    const csv = [
      "金融機関,資産名,残高",
      "bitFlyer,ビットコイン,",
      ",ビットコイン,1000",
      "SBI証券,トヨタ自動車,300000",
    ].join("\n");

    const { rows, skippedRows } = parseMoneyForwardAssetBalanceCsv(csv, {
      institutionColumn: "金融機関",
      assetNameColumn: "資産名",
      balanceColumn: "残高",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].institution).toBe("SBI証券");
    expect(skippedRows).toHaveLength(2);
  });

  it("解釈できない残高・日付はスキップして理由を報告する", () => {
    const csv = [
      "日付,金融機関,資産名,残高",
      "2026/1/1,bitFlyer,ビットコイン,不正な数値",
      "不正な日付,SBI証券,トヨタ自動車,300000",
    ].join("\n");

    const { rows, skippedRows } = parseMoneyForwardAssetBalanceCsv(csv, {
      dateColumn: "日付",
      institutionColumn: "金融機関",
      assetNameColumn: "資産名",
      balanceColumn: "残高",
    });

    expect(rows).toHaveLength(0);
    expect(skippedRows[0].reason).toMatch(/残高/);
    expect(skippedRows[1].reason).toMatch(/日付/);
  });

  it("指定した列名がCSVに存在しない場合はエラーを投げる", () => {
    expect(() =>
      parseMoneyForwardAssetBalanceCsv(CSV, { ...MAPPING, institutionColumn: "存在しない列" }),
    ).toThrow(/金融機関/);
  });

  it("空のCSVは空の結果を返す", () => {
    const { rows, skippedRows } = parseMoneyForwardAssetBalanceCsv("", MAPPING);
    expect(rows).toEqual([]);
    expect(skippedRows).toEqual([]);
  });
});
