import { Decimal } from "decimal.js";
import { normalizeNumericString, parseCsvRows, parseFlexibleDateTime } from "../csv";

/**
 * FX(店頭外国為替証拠金取引)・先物・CFD等の決済損益CSV取り込み。
 *
 * DMM FX・GMOクリック証券等の決済履歴は、暗号資産の証拠金取引CSV
 * (`src/lib/crypto/marginCsv.ts`)と同様「決済ごとの建玉損益」がそのまま
 * 課税所得(先物取引に係る雑所得等)になる形式だが、業者によって列構成の
 * 差が大きく公開情報からの検証もできていない。そのため既知の業者向け
 * プリセットは用意せず、暗号資産の証拠金取引CSVと同様にユーザーがCSVの
 * ヘッダー名を指定する汎用マッピングのみを提供する(誤って現物取引と
 * 同じ数量×単価の計算モデルで解釈してしまうことを避けるため)。
 */

export interface FuturesCsvMapping {
  /** 決済日時の列名 */
  dateColumn: string;
  /** 銘柄・通貨ペアの列名 */
  symbolColumn: string;
  /** 決済損益(円)の列名。損失は負の値、またはマイナス記号付きの文字列を想定 */
  pnlColumn: string;
  /** 手数料(円)の列名(任意) */
  feeColumn?: string;
  /** スワップポイント等(円。FXのみ)の列名(任意) */
  swapColumn?: string;
}

export interface FuturesCsvRow {
  settledAt: Date;
  symbol: string;
  realizedPnlJpy: Decimal;
  feeJpy: Decimal;
  swapJpy: Decimal;
}

export interface FuturesCsvSkip {
  lineNumber: number;
  reason: string;
}

export interface FuturesCsvParseResult {
  rows: FuturesCsvRow[];
  skippedRows: FuturesCsvSkip[];
}

function buildHeaderIndex(headerRow: string[]): Map<string, number> {
  const index = new Map<string, number>();
  headerRow.forEach((header, i) => {
    const key = header.trim();
    if (key && !index.has(key)) index.set(key, i);
  });
  return index;
}

function parseFlexibleDate(value: string | undefined): Date | null {
  const parsed = parseFlexibleDateTime(value);
  if (parsed) return parsed;
  if (!value) return null;
  const fallback = new Date(value.trim());
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function parseDecimalStrict(value: string | undefined): Decimal | null {
  const normalized = normalizeNumericString(value);
  return normalized ? new Decimal(normalized) : null;
}

/**
 * ユーザーが指定した列名マッピングに基づき、先物取引・FXの決済損益CSVを取り込む。
 * 決済損益(pnlColumn)は損失を表す負の値をそのまま許容する点が現物取引CSVと異なる。
 */
export function parseFuturesCsv(
  csvText: string,
  mapping: FuturesCsvMapping,
): FuturesCsvParseResult {
  const csvRows = parseCsvRows(csvText);
  if (csvRows.length === 0) {
    return { rows: [], skippedRows: [] };
  }

  const headerRow = csvRows[0];
  const fieldIndex = buildHeaderIndex(headerRow);
  const requiredColumns: [string, string][] = [
    ["決済日時", mapping.dateColumn],
    ["銘柄", mapping.symbolColumn],
    ["決済損益", mapping.pnlColumn],
  ];
  const missing = requiredColumns.filter(([, column]) => !fieldIndex.has(column.trim()));
  if (missing.length > 0) {
    throw new Error(
      `指定された列名がCSVに見つかりませんでした: ${missing
        .map(([label, column]) => `${label}=「${column}」`)
        .join(", ")}`,
    );
  }

  const dateIndex = fieldIndex.get(mapping.dateColumn.trim())!;
  const symbolIndex = fieldIndex.get(mapping.symbolColumn.trim())!;
  const pnlIndex = fieldIndex.get(mapping.pnlColumn.trim())!;
  const feeIndex = mapping.feeColumn ? fieldIndex.get(mapping.feeColumn.trim()) : undefined;
  const swapIndex = mapping.swapColumn ? fieldIndex.get(mapping.swapColumn.trim()) : undefined;

  const rows: FuturesCsvRow[] = [];
  const skippedRows: FuturesCsvSkip[] = [];

  for (let i = 1; i < csvRows.length; i++) {
    const cols = csvRows[i];
    const lineNumber = i + 1;
    const rawDate = cols[dateIndex];
    const rawSymbol = cols[symbolIndex];
    const rawPnl = cols[pnlIndex];

    if (!rawDate || !rawSymbol || !rawPnl) {
      skippedRows.push({ lineNumber, reason: "必須項目(決済日時/銘柄/決済損益)が空です" });
      continue;
    }

    const settledAt = parseFlexibleDate(rawDate);
    if (!settledAt) {
      skippedRows.push({ lineNumber, reason: `決済日時を解釈できません: "${rawDate}"` });
      continue;
    }

    const realizedPnlJpy = parseDecimalStrict(rawPnl);
    if (!realizedPnlJpy) {
      skippedRows.push({ lineNumber, reason: `決済損益を解釈できません: "${rawPnl}"` });
      continue;
    }

    let feeJpy = new Decimal(0);
    if (feeIndex !== undefined) {
      const rawFee = cols[feeIndex];
      if (rawFee && rawFee.trim() !== "") {
        const parsedFee = parseDecimalStrict(rawFee);
        if (parsedFee === null) {
          skippedRows.push({ lineNumber, reason: `手数料を解釈できません: "${rawFee}"` });
          continue;
        }
        feeJpy = parsedFee.abs();
      }
    }

    let swapJpy = new Decimal(0);
    if (swapIndex !== undefined) {
      const rawSwap = cols[swapIndex];
      if (rawSwap && rawSwap.trim() !== "") {
        const parsedSwap = parseDecimalStrict(rawSwap);
        if (parsedSwap === null) {
          skippedRows.push({ lineNumber, reason: `スワップポイントを解釈できません: "${rawSwap}"` });
          continue;
        }
        swapJpy = parsedSwap;
      }
    }

    rows.push({
      settledAt,
      symbol: rawSymbol.trim(),
      realizedPnlJpy,
      feeJpy,
      swapJpy,
    });
  }

  return { rows, skippedRows };
}
