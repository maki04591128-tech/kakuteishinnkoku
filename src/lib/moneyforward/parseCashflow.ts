import { Decimal } from "decimal.js";
import { parseCsvRows } from "@/lib/csv";

/**
 * マネーフォワード ME の「家計簿」CSVエクスポート(収入・支出データ)のパーサー。
 *
 * 標準的なヘッダーは以下の通り:
 *   計算対象,日付,内容,金額（円）,保有金融機関,大項目,中項目,メモ,振替,ID
 *
 * ヘッダー名でカラムを特定するため、列の並び順が変わっても追従できる。
 * 個々の行の解析に失敗しても致命的エラーにはせず、skippedRows に理由を
 * 記録した上で処理を継続する(一部の行が壊れていてもファイル全体を
 * 無駄にしないため)。
 */

export type CashflowDirection = "INCOME" | "EXPENSE";

export interface MoneyForwardCashflowRow {
  date: Date;
  content: string;
  /** 符号付き金額(支出は負の値)。マネーフォワードの出力をそのまま保持する。 */
  amountJpy: Decimal;
  direction: CashflowDirection;
  institution: string | null;
  largeCategory: string | null;
  middleCategory: string | null;
  memo: string | null;
  /** マネーフォワード側の「計算対象」チェック(振替等の除外判定に使用) */
  isCalculationTarget: boolean;
}

export interface MoneyForwardParseSkip {
  lineNumber: number;
  reason: string;
}

export interface MoneyForwardParseResult {
  rows: MoneyForwardCashflowRow[];
  skippedRows: MoneyForwardParseSkip[];
}

const HEADER_ALIASES: Record<string, string> = {
  計算対象: "isCalculationTarget",
  日付: "date",
  内容: "content",
  "金額（円）": "amountJpy",
  "金額(円)": "amountJpy",
  保有金融機関: "institution",
  大項目: "largeCategory",
  中項目: "middleCategory",
  メモ: "memo",
  振替: "isTransfer",
  ID: "id",
};

const REQUIRED_FIELDS = ["date", "content", "amountJpy"] as const;

function parseJapaneseDate(value: string): Date | null {
  const trimmed = value.trim();
  // 想定形式: YYYY/MM/DD または YYYY-MM-DD
  const match = trimmed.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function parseMoneyForwardCashflowCsv(csvText: string): MoneyForwardParseResult {
  const csvRows = parseCsvRows(csvText);
  if (csvRows.length === 0) {
    return { rows: [], skippedRows: [] };
  }

  const headerRow = csvRows[0];
  const fieldIndex = new Map<string, number>();
  headerRow.forEach((header, index) => {
    const key = HEADER_ALIASES[header.trim()];
    if (key) fieldIndex.set(key, index);
  });

  const missingRequired = REQUIRED_FIELDS.filter((f) => !fieldIndex.has(f));
  if (missingRequired.length > 0) {
    throw new Error(
      `マネーフォワードのCSV形式として認識できませんでした。不足しているカラム: ${missingRequired.join(", ")}`,
    );
  }

  const rows: MoneyForwardCashflowRow[] = [];
  const skippedRows: MoneyForwardParseSkip[] = [];

  const get = (cols: string[], key: string): string | undefined => {
    const index = fieldIndex.get(key);
    if (index === undefined) return undefined;
    return cols[index];
  };

  for (let i = 1; i < csvRows.length; i++) {
    const cols = csvRows[i];
    const lineNumber = i + 1;

    const rawDate = get(cols, "date");
    const rawContent = get(cols, "content");
    const rawAmount = get(cols, "amountJpy");

    if (!rawDate || !rawContent || rawAmount === undefined || rawAmount === "") {
      skippedRows.push({ lineNumber, reason: "必須項目(日付/内容/金額)が空です" });
      continue;
    }

    const date = parseJapaneseDate(rawDate);
    if (!date) {
      skippedRows.push({ lineNumber, reason: `日付を解釈できません: "${rawDate}"` });
      continue;
    }

    const normalizedAmount = rawAmount.replace(/,/g, "").trim();
    if (!/^-?\d+(\.\d+)?$/.test(normalizedAmount)) {
      skippedRows.push({ lineNumber, reason: `金額を解釈できません: "${rawAmount}"` });
      continue;
    }
    const amountJpy = new Decimal(normalizedAmount);

    const isCalcTargetRaw = get(cols, "isCalculationTarget");
    const isCalculationTarget = isCalcTargetRaw === undefined ? true : isCalcTargetRaw.trim() === "1";

    rows.push({
      date,
      content: rawContent.trim(),
      amountJpy,
      direction: amountJpy.isNegative() ? "EXPENSE" : "INCOME",
      institution: get(cols, "institution")?.trim() || null,
      largeCategory: get(cols, "largeCategory")?.trim() || null,
      middleCategory: get(cols, "middleCategory")?.trim() || null,
      memo: get(cols, "memo")?.trim() || null,
      isCalculationTarget,
    });
  }

  return { rows, skippedRows };
}
