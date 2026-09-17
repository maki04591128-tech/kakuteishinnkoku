import { Decimal } from "decimal.js";
import { normalizeNumericString, parseCsvRows, parseFlexibleDateTime } from "../csv";

/**
 * 暗号資産の証拠金(レバレッジ)取引の決済損益CSV取り込み。
 *
 * DMM Bitcoin・SBI VCトレード等の証拠金取引の取引報告書は、現物取引のCSV
 * (`exchangeCsv.ts`)とは異なり「決済ごとの建玉損益」がそのまま課税所得になる
 * 形式で、取引所によって列構成の差が大きく公開情報からの検証もできていない。
 * そのため既知の取引所向けプリセットは用意せず、`exchangeCsv.ts`の手動マッピング
 * 方式と同様に、ユーザーがCSVのヘッダー名を指定する汎用マッピングのみを提供する
 * (誤って現物取引と同じモデルで解釈してしまうことを避けるため)。
 */

/**
 * 手動マッピング欄の入力補助用。DMM Bitcoin・SBI VCトレード等の証拠金取引の
 * 取引報告書CSVで使われることが多い列見出し表記の候補一覧
 * (`/import`画面の証拠金取引CSV取り込み欄で各入力欄の`<datalist>`候補として使う)。
 *
 * `exchangeCsv.ts`の`HEADER_ALIASES`と異なり自動認識には使わない(証拠金取引は
 * 取引所ごとの列構成の差異が大きく誤認識のリスクが高いため、あくまで手入力の
 * 補助に留める)。実データでの検証は今後の課題(README ロードマップ参照)。
 */
export const COMMON_MARGIN_CSV_HEADER_NAMES: Record<
  "date" | "symbol" | "pnl" | "fee" | "swap",
  string[]
> = {
  date: ["決済日時", "約定日時", "取引日時", "決済日", "Date", "Settlement Date"],
  symbol: ["銘柄", "銘柄名", "通貨ペア", "商品", "Symbol", "Product"],
  pnl: [
    "決済損益",
    "建玉損益",
    "実現損益",
    "決済損益(円)",
    "損益",
    "評価損益",
    "Realized P/L",
    "Profit/Loss",
  ],
  fee: ["手数料", "取引手数料", "決済手数料", "Fee"],
  swap: ["スワップ", "スワップポイント", "建玉管理料", "Swap"],
};

export interface MarginCsvMapping {
  /** 決済日時の列名 */
  dateColumn: string;
  /** 銘柄の列名 */
  symbolColumn: string;
  /** 決済損益(円)の列名。損失は負の値、またはマイナス記号付きの文字列を想定 */
  pnlColumn: string;
  /** 手数料(円)の列名(任意) */
  feeColumn?: string;
  /** スワップポイント・建玉管理料等(円)の列名(任意) */
  swapColumn?: string;
}

export interface MarginCsvRow {
  settledAt: Date;
  symbol: string;
  realizedPnlJpy: Decimal;
  feeJpy: Decimal;
  swapJpy: Decimal;
}

export interface MarginCsvSkip {
  lineNumber: number;
  reason: string;
}

export interface MarginCsvParseResult {
  rows: MarginCsvRow[];
  skippedRows: MarginCsvSkip[];
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
 * ユーザーが指定した列名マッピングに基づき、証拠金取引の決済損益CSVを取り込む。
 * 決済損益(pnlColumn)は損失を表す負の値をそのまま許容する点が現物取引CSVと異なる。
 */
export function parseCryptoMarginCsv(
  csvText: string,
  mapping: MarginCsvMapping,
): MarginCsvParseResult {
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

  const rows: MarginCsvRow[] = [];
  const skippedRows: MarginCsvSkip[] = [];

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
      symbol: rawSymbol.trim().toUpperCase(),
      realizedPnlJpy,
      feeJpy,
      swapJpy,
    });
  }

  return { rows, skippedRows };
}
