import { Decimal } from "decimal.js";
import { normalizeNumericString } from "../csv";
import type { AnnualReportAccountType } from "./annualReportCsv";

/**
 * 証券会社が発行する「特定口座年間取引報告書」のテキスト貼り付け取り込み。
 *
 * 報告書自体はPDFで発行されるのが基本だが、本ツールはPDFバイナリそのものの
 * レイアウト解析・OCRには対応しない(証券会社ごとの様式差異が大きく、画像化
 * された(テキスト層のない)PDFも存在するため、誤読のリスクなしに汎用対応する
 * のは難しい)。そのため、PDFビューアでコピーした本文テキスト(またはテキスト
 * として保存した内容)を貼り付ける方式とする。国税庁の様式(租税特別措置法
 * 施行規則)で「譲渡の対価の額(収入金額)」「取得費及び譲渡に要した費用の額等」
 * 「配当等の額」等の文言は証券会社によらず共通のため、これらのラベルを手がかりに
 * 金額を抽出する。証券会社名・口座区分の自動判定はレイアウトの揺れが大きく確実
 * ではないため、あくまで「推測値」として画面上で補完表示するに留め、登録前に
 * 必ずユーザーが確認・修正できるようにする(金額が抽出できた場合もラベルが
 * 想定と異なる位置に金額を含む可能性があるため、登録前の確認を必須とする)。
 */

export interface AnnualReportTextParseResult {
  /** 譲渡の対価の額(収入金額) */
  proceedsJpy: Decimal | null;
  /** 取得費及び譲渡に要した費用の額等 */
  acquisitionCostJpy: Decimal | null;
  /** 差引金額(譲渡所得等の金額)。参考表示・突合用で登録には使わない */
  netGainJpy: Decimal | null;
  /** 配当等の額 */
  dividendJpy: Decimal | null;
  /** 証券会社名の推測値(確実ではないため要確認) */
  brokerGuess: string | null;
  /** 口座区分の推測値(確実ではないため要確認) */
  accountTypeGuess: AnnualReportAccountType | null;
}

// ラベル直後、この文字数以内に現れる最初の金額らしき数値を採用する。
// 報告書はラベルと金額の間に注記や空白・改行(PDFのテキスト抽出順序のずれ)が
// 入ることがあるため、ある程度の余白を持たせる。
const LOOKAHEAD_CHARS = 60;

const AMOUNT_PATTERN = /[▲△-]?[0-9][0-9,]*/;

function findAmountAfterLabel(text: string, labels: RegExp[]): Decimal | null {
  for (const label of labels) {
    const match = label.exec(text);
    if (!match) continue;
    const searchStart = match.index + match[0].length;
    const window = text.slice(searchStart, searchStart + LOOKAHEAD_CHARS);
    const amountMatch = AMOUNT_PATTERN.exec(window);
    if (!amountMatch) continue;
    const raw = amountMatch[0];
    const negative = raw.startsWith("▲") || raw.startsWith("△");
    const digits = raw.replace(/^[▲△]/, "");
    const normalized = normalizeNumericString(digits);
    if (!normalized) continue;
    const value = new Decimal(normalized);
    return negative ? value.negated() : value;
  }
  return null;
}

const PROCEEDS_LABELS = [/譲渡の対価の額/];
const ACQUISITION_COST_LABELS = [/取得費及び譲渡に要した費用の額等/, /取得費及び譲渡費用の額等/];
const NET_GAIN_LABELS = [/差引金額/];
const DIVIDEND_LABELS = [/配当等の額/];

function guessBrokerName(text: string): string | null {
  // 「〇〇証券」「〇〇証券株式会社」「〇〇銀行」のような社名を先頭から探す。
  // 前後に数字が続く(=金額欄の一部を誤検出した)場合は除外する。
  const pattern = /[^\s　0-9０-９,]{2,20}(?:証券|銀行)(?:株式会社)?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const name = match[0].trim();
    if (name.length >= 3) return name;
  }
  return null;
}

function guessAccountType(text: string): AnnualReportAccountType | null {
  if (/源泉徴収.{0,4}なし/.test(text) || /源泉徴収を選択.{0,4}なかった/.test(text)) {
    return "SPECIFIC_NO_WITHHOLDING";
  }
  if (/源泉徴収.{0,4}あり/.test(text) || /源泉徴収を選択.{0,4}した/.test(text)) {
    return "SPECIFIC_WITHHOLDING";
  }
  if (/一般口座/.test(text) && !/特定口座/.test(text)) {
    return "GENERAL";
  }
  return null;
}

export function parseAnnualReportText(text: string): AnnualReportTextParseResult {
  const normalized = text.normalize("NFKC");

  return {
    proceedsJpy: findAmountAfterLabel(normalized, PROCEEDS_LABELS),
    acquisitionCostJpy: findAmountAfterLabel(normalized, ACQUISITION_COST_LABELS),
    netGainJpy: findAmountAfterLabel(normalized, NET_GAIN_LABELS),
    dividendJpy: findAmountAfterLabel(normalized, DIVIDEND_LABELS),
    brokerGuess: guessBrokerName(normalized),
    accountTypeGuess: guessAccountType(normalized),
  };
}
