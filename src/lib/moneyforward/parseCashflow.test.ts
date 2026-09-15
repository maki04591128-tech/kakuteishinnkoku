import { describe, expect, it } from "vitest";
import { parseMoneyForwardCashflowCsv } from "./parseCashflow";

const SAMPLE_CSV = [
  "計算対象,日付,内容,金額（円）,保有金融機関,大項目,中項目,メモ,振替,ID",
  '1,2026/1/15,スーパーでの買い物,-3500,楽天カード,食費,食料品,,0,abc123',
  '1,2026/1/25,給与,300000,住信SBIネット銀行,収入,給与,,0,abc124',
  '1,2026/2/1,"コイン,チェック手数料",-500,bitFlyer,通信費,その他,,0,abc125',
].join("\n");

describe("parseMoneyForwardCashflowCsv", () => {
  it("標準的なMoneyForward CSVを解析する", () => {
    const result = parseMoneyForwardCashflowCsv(SAMPLE_CSV);

    expect(result.skippedRows).toEqual([]);
    expect(result.rows).toHaveLength(3);

    const [first, second, third] = result.rows;
    expect(first.content).toBe("スーパーでの買い物");
    expect(first.amountJpy.toNumber()).toBe(-3500);
    expect(first.direction).toBe("EXPENSE");
    expect(first.largeCategory).toBe("食費");

    expect(second.amountJpy.toNumber()).toBe(300000);
    expect(second.direction).toBe("INCOME");

    // クォート内のカンマを含む内容も正しく1フィールドとして扱われる
    expect(third.content).toBe("コイン,チェック手数料");
  });

  it("列の並び順が変わっても解析できる", () => {
    const reordered = [
      "日付,金額（円）,内容,計算対象",
      "2026/3/1,-1000,テスト,1",
    ].join("\n");

    const result = parseMoneyForwardCashflowCsv(reordered);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].content).toBe("テスト");
    expect(result.rows[0].amountJpy.toNumber()).toBe(-1000);
  });

  it("必須カラムが欠けている場合はエラーを投げる", () => {
    expect(() => parseMoneyForwardCashflowCsv("内容,メモ\nテスト,memo")).toThrow();
  });

  it("壊れた行はスキップし、正常な行の処理は継続する", () => {
    const csv = [
      "日付,内容,金額（円）",
      "invalid-date,テスト1,1000",
      "2026/1/1,テスト2,not-a-number",
      "2026/1/2,テスト3,2000",
    ].join("\n");

    const result = parseMoneyForwardCashflowCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].content).toBe("テスト3");
    expect(result.skippedRows).toHaveLength(2);
    expect(result.skippedRows[0].lineNumber).toBe(2);
    expect(result.skippedRows[1].lineNumber).toBe(3);
  });

  it("計算対象カラムが無い場合はデフォルトでtrueとする", () => {
    const csv = ["日付,内容,金額（円）", "2026/1/1,テスト,1000"].join("\n");
    const result = parseMoneyForwardCashflowCsv(csv);
    expect(result.rows[0].isCalculationTarget).toBe(true);
  });

  it("計算対象が0の行はisCalculationTarget=falseになる", () => {
    const csv = [
      "計算対象,日付,内容,金額（円）",
      "0,2026/1/1,口座振替,1000",
    ].join("\n");
    const result = parseMoneyForwardCashflowCsv(csv);
    expect(result.rows[0].isCalculationTarget).toBe(false);
  });
});
