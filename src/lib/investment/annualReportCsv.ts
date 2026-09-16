import { Decimal } from "decimal.js";
import { normalizeNumericString, parseCsvRows } from "../csv";

/**
 * 証券会社の特定口座年間取引報告書データのCSV取り込み(汎用マッピング方式)。
 *
 * 年間取引報告書そのものは証券会社が発行するPDFが基本であり、CSVでの提供
 * 有無・列構成は証券会社ごとに異なり公開情報からの検証もできていない。
 * そのため`marginCsv.ts`・`exchangeCsv.ts`の手動マッピング欄と同様、
 * 列見出しをユーザーが指定する汎用マッピングのみを提供する。1行が
 * 「1つの証券会社・口座区分の年間サマリー」に対応する前提とし、複数の証券会社・
 * 口座区分の報告書をまとめて登録する用途を想定する(単一の報告書の内訳明細
 * ではない)。口座区分は日本語表記の揺れをある程度吸収するが、判定できない
 * 場合は安全側に倒してスキップし、手入力を促す。
 */

export type AnnualReportAccountType =
  | "SPECIFIC_WITHHOLDING"
  | "SPECIFIC_NO_WITHHOLDING"
  | "GENERAL";

export interface AnnualReportCsvMapping {
  /** 証券会社名の列名 */
  brokerColumn: string;
  /** 口座区分の列名 */
  accountTypeColumn: string;
  /** 譲渡の対価の額(収入金額)の列名 */
  proceedsColumn: string;
  /** 取得費及び譲渡に要した費用の額等の列名 */
  acquisitionCostColumn: string;
  /** 配当等の額の列名(任意) */
  dividendColumn?: string;
}

export interface AnnualReportCsvRow {
  broker: string;
  accountType: AnnualReportAccountType;
  proceedsJpy: Decimal;
  acquisitionCostJpy: Decimal;
  dividendJpy: Decimal;
}

export interface AnnualReportCsvSkip {
  lineNumber: number;
  reason: string;
}

export interface AnnualReportCsvParseResult {
  rows: AnnualReportCsvRow[];
  skippedRows: AnnualReportCsvSkip[];
}

const ACCOUNT_TYPE_ALIASES: Record<string, AnnualReportAccountType> = {
  "特定口座(源泉徴収あり)": "SPECIFIC_WITHHOLDING",
  "特定(源泉徴収あり)": "SPECIFIC_WITHHOLDING",
  "源泉徴収あり": "SPECIFIC_WITHHOLDING",
  "特定口座源泉徴収あり": "SPECIFIC_WITHHOLDING",
  SPECIFIC_WITHHOLDING: "SPECIFIC_WITHHOLDING",
  "特定口座(源泉徴収なし)": "SPECIFIC_NO_WITHHOLDING",
  "特定(源泉徴収なし)": "SPECIFIC_NO_WITHHOLDING",
  "源泉徴収なし": "SPECIFIC_NO_WITHHOLDING",
  "特定口座源泉徴収なし": "SPECIFIC_NO_WITHHOLDING",
  SPECIFIC_NO_WITHHOLDING: "SPECIFIC_NO_WITHHOLDING",
  "一般口座": "GENERAL",
  "一般": "GENERAL",
  GENERAL: "GENERAL",
};

function normalizeAccountType(value: string | undefined): AnnualReportAccountType | null {
  if (!value) return null;
  const key = value.trim().replace(/\s+/g, "");
  return ACCOUNT_TYPE_ALIASES[key] ?? null;
}

function buildHeaderIndex(headerRow: string[]): Map<string, number> {
  const index = new Map<string, number>();
  headerRow.forEach((header, i) => {
    const key = header.trim();
    if (key && !index.has(key)) index.set(key, i);
  });
  return index;
}

function parseDecimalStrict(value: string | undefined): Decimal | null {
  const normalized = normalizeNumericString(value);
  return normalized ? new Decimal(normalized) : null;
}

export function parseBrokerAnnualReportCsv(
  csvText: string,
  mapping: AnnualReportCsvMapping,
): AnnualReportCsvParseResult {
  const csvRows = parseCsvRows(csvText);
  if (csvRows.length === 0) {
    return { rows: [], skippedRows: [] };
  }

  const headerRow = csvRows[0];
  const fieldIndex = buildHeaderIndex(headerRow);
  const requiredColumns: [string, string][] = [
    ["証券会社", mapping.brokerColumn],
    ["口座区分", mapping.accountTypeColumn],
    ["譲渡の対価の額", mapping.proceedsColumn],
    ["取得費及び譲渡費用の額等", mapping.acquisitionCostColumn],
  ];
  const missing = requiredColumns.filter(([, column]) => !fieldIndex.has(column.trim()));
  if (missing.length > 0) {
    throw new Error(
      `指定された列名がCSVに見つかりませんでした: ${missing
        .map(([label, column]) => `${label}=「${column}」`)
        .join(", ")}`,
    );
  }

  const brokerIndex = fieldIndex.get(mapping.brokerColumn.trim())!;
  const accountTypeIndex = fieldIndex.get(mapping.accountTypeColumn.trim())!;
  const proceedsIndex = fieldIndex.get(mapping.proceedsColumn.trim())!;
  const acquisitionCostIndex = fieldIndex.get(mapping.acquisitionCostColumn.trim())!;
  const dividendIndex = mapping.dividendColumn
    ? fieldIndex.get(mapping.dividendColumn.trim())
    : undefined;

  const rows: AnnualReportCsvRow[] = [];
  const skippedRows: AnnualReportCsvSkip[] = [];

  for (let i = 1; i < csvRows.length; i++) {
    const cols = csvRows[i];
    const lineNumber = i + 1;
    const rawBroker = cols[brokerIndex];
    const rawAccountType = cols[accountTypeIndex];
    const rawProceeds = cols[proceedsIndex];
    const rawAcquisitionCost = cols[acquisitionCostIndex];

    if (!rawBroker || !rawAccountType || !rawProceeds || !rawAcquisitionCost) {
      skippedRows.push({
        lineNumber,
        reason: "必須項目(証券会社/口座区分/譲渡の対価の額/取得費及び譲渡費用の額等)が空です",
      });
      continue;
    }

    const broker = rawBroker.trim();
    if (!broker) {
      skippedRows.push({ lineNumber, reason: "証券会社名が空です" });
      continue;
    }

    const accountType = normalizeAccountType(rawAccountType);
    if (!accountType) {
      skippedRows.push({
        lineNumber,
        reason: `口座区分を解釈できません: "${rawAccountType}"(特定口座(源泉徴収あり/なし)・一般口座のいずれかを想定)`,
      });
      continue;
    }

    const proceedsJpy = parseDecimalStrict(rawProceeds);
    if (!proceedsJpy) {
      skippedRows.push({ lineNumber, reason: `譲渡の対価の額を解釈できません: "${rawProceeds}"` });
      continue;
    }

    const acquisitionCostJpy = parseDecimalStrict(rawAcquisitionCost);
    if (!acquisitionCostJpy) {
      skippedRows.push({
        lineNumber,
        reason: `取得費及び譲渡費用の額等を解釈できません: "${rawAcquisitionCost}"`,
      });
      continue;
    }

    let dividendJpy = new Decimal(0);
    if (dividendIndex !== undefined) {
      const rawDividend = cols[dividendIndex];
      if (rawDividend && rawDividend.trim() !== "") {
        const parsedDividend = parseDecimalStrict(rawDividend);
        if (parsedDividend === null) {
          skippedRows.push({ lineNumber, reason: `配当等の額を解釈できません: "${rawDividend}"` });
          continue;
        }
        dividendJpy = parsedDividend;
      }
    }

    rows.push({ broker, accountType, proceedsJpy, acquisitionCostJpy, dividendJpy });
  }

  return { rows, skippedRows };
}
