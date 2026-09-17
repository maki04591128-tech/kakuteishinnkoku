import { describe, expect, it } from "vitest";
import { parseAnnualReportText } from "./annualReportText";

describe("parseAnnualReportText", () => {
  it("典型的な特定口座年間取引報告書のテキストから金額を抽出できる", () => {
    const text = `
      特定口座年間取引報告書
      SBI証券株式会社

      口座内において生じた金額
      ① 譲渡の対価の額（収入金額）　　　1,234,567
      ② 取得費及び譲渡に要した費用の額等　1,000,000
      ③ 差引金額（譲渡所得等の金額）　　　234,567

      配当等の額及び源泉徴収税額
      配当等の額　　50,000

      特定口座源泉徴収選択届出書の提出　有（源泉徴収あり）
    `;

    const result = parseAnnualReportText(text);

    expect(result.proceedsJpy?.toString()).toBe("1234567");
    expect(result.acquisitionCostJpy?.toString()).toBe("1000000");
    expect(result.netGainJpy?.toString()).toBe("234567");
    expect(result.dividendJpy?.toString()).toBe("50000");
    expect(result.brokerGuess).toBe("SBI証券株式会社");
    expect(result.accountTypeGuess).toBe("SPECIFIC_WITHHOLDING");
  });

  it("全角数字・全角括弧でも解釈できる(NFKC正規化)", () => {
    const text = `楽天証券株式会社
      譲渡の対価の額(収入金額)　　　１，２３４，５６７
      取得費及び譲渡に要した費用の額等　１，０００，０００
      源泉徴収なし`;

    const result = parseAnnualReportText(text);

    expect(result.proceedsJpy?.toString()).toBe("1234567");
    expect(result.acquisitionCostJpy?.toString()).toBe("1000000");
    expect(result.accountTypeGuess).toBe("SPECIFIC_NO_WITHHOLDING");
  });

  it("差引金額がマイナス(損失)の場合、▲・△付きの表記を負の値として解釈する", () => {
    const text = `
      譲渡の対価の額（収入金額）　500,000
      取得費及び譲渡に要した費用の額等　800,000
      差引金額（譲渡所得等の金額）　▲300,000
    `;

    const result = parseAnnualReportText(text);

    expect(result.netGainJpy?.toString()).toBe("-300000");
  });

  it("一般口座(源泉徴収の記載がない)は口座区分をGENERALと推測する", () => {
    const text = `
      年間取引報告書
      一般口座
      譲渡の対価の額（収入金額）　100,000
      取得費及び譲渡に要した費用の額等　90,000
    `;

    const result = parseAnnualReportText(text);

    expect(result.accountTypeGuess).toBe("GENERAL");
  });

  it("該当するラベルが見つからない場合はnullを返し、例外にしない", () => {
    const result = parseAnnualReportText("関係のないテキストです。");

    expect(result.proceedsJpy).toBeNull();
    expect(result.acquisitionCostJpy).toBeNull();
    expect(result.netGainJpy).toBeNull();
    expect(result.dividendJpy).toBeNull();
    expect(result.brokerGuess).toBeNull();
    expect(result.accountTypeGuess).toBeNull();
  });

  it("配当等の額が記載されていない書類でも他の項目は抽出できる", () => {
    const text = `
      譲渡の対価の額（収入金額）　2,000,000
      取得費及び譲渡に要した費用の額等　1,800,000
    `;

    const result = parseAnnualReportText(text);

    expect(result.proceedsJpy?.toString()).toBe("2000000");
    expect(result.acquisitionCostJpy?.toString()).toBe("1800000");
    expect(result.dividendJpy).toBeNull();
  });

  it("空文字列を渡しても例外にならない", () => {
    const result = parseAnnualReportText("");

    expect(result.proceedsJpy).toBeNull();
    expect(result.brokerGuess).toBeNull();
  });
});
