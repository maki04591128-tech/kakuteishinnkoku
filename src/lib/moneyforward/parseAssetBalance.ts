import { Decimal } from "decimal.js";
import { normalizeNumericString, parseCsvRows, parseFlexibleDateTime } from "../csv";

/**
 * マネーフォワード ME の資産残高(「資産の内訳」画面のCSVエクスポート等)の取り込み。
 *
 * 家計簿CSV(parseCashflow.ts)とは異なり、資産の内訳CSVの列見出しの構成は
 * 公開情報から確認できておらず、プランや対象資産種類によっても変わりうる
 * ため未検証。そのため`marginCsv.ts`と同様、既知プリセットは用意せず
 * ユーザーが列名を指定する汎用マッピング方式のみで取り込む(誤った列を
 * 残高として取り込むより、認識できない場合は例外にして気付けるようにする)。
 *
 * 取り込んだ結果は損益計算には使わず、`assetBalanceReconciliation.ts`で
 * アプリ内の取引明細の金融機関と突き合わせて計上漏れの疑いを検知する
 * 参照データとしてのみ利用する。
 */

export interface AssetBalanceCsvMapping {
  /** 保有金融機関の列名 */
  institutionColumn: string;
  /** 資産名の列名 */
  assetNameColumn: string;
  /** 残高・評価額(円)の列名 */
  balanceColumn: string;
  /** 残高時点の日付列名(任意。省略・空欄の行はインポート日時点として扱う) */
  dateColumn?: string;
  /** 大分類・種類の列名(任意) */
  categoryColumn?: string;
  /**
   * 保有数量の列名(任意)。指定するとアプリ内取引明細から計算した数量との
   * 突合(assetBalanceReconciliation.tsの数量整合性チェック)が行える。
   * 評価額(balanceColumn)と異なり時価に左右されないため、突合の精度が高い。
   */
  quantityColumn?: string;
}

export interface AssetBalanceCsvRow {
  /** null の場合は呼び出し側でインポート日時を採用する */
  snapshotDate: Date | null;
  institution: string;
  assetName: string;
  category: string;
  balanceJpy: Decimal;
  /** quantityColumn未指定、またはそのセルが空欄の場合はnull */
  quantity: Decimal | null;
}

export interface AssetBalanceCsvSkip {
  lineNumber: number;
  reason: string;
}

export interface AssetBalanceCsvParseResult {
  rows: AssetBalanceCsvRow[];
  skippedRows: AssetBalanceCsvSkip[];
}

function buildHeaderIndex(headerRow: string[]): Map<string, number> {
  const index = new Map<string, number>();
  headerRow.forEach((header, i) => {
    const key = header.trim();
    if (key && !index.has(key)) index.set(key, i);
  });
  return index;
}

function parseFlexibleDate(value: string): Date | null {
  const parsed = parseFlexibleDateTime(value);
  if (parsed) return parsed;
  const fallback = new Date(value.trim());
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * ユーザーが指定した列名マッピングに基づき、資産残高CSVを取り込む。
 * 金融機関・資産名・残高のいずれかが空の行はスキップする。
 */
export function parseMoneyForwardAssetBalanceCsv(
  csvText: string,
  mapping: AssetBalanceCsvMapping,
): AssetBalanceCsvParseResult {
  const csvRows = parseCsvRows(csvText);
  if (csvRows.length === 0) {
    return { rows: [], skippedRows: [] };
  }

  const headerRow = csvRows[0];
  const fieldIndex = buildHeaderIndex(headerRow);
  const requiredColumns: [string, string][] = [
    ["金融機関", mapping.institutionColumn],
    ["資産名", mapping.assetNameColumn],
    ["残高", mapping.balanceColumn],
  ];
  const missing = requiredColumns.filter(([, column]) => !fieldIndex.has(column.trim()));
  if (missing.length > 0) {
    throw new Error(
      `指定された列名がCSVに見つかりませんでした: ${missing
        .map(([label, column]) => `${label}=「${column}」`)
        .join(", ")}`,
    );
  }

  const institutionIndex = fieldIndex.get(mapping.institutionColumn.trim())!;
  const assetNameIndex = fieldIndex.get(mapping.assetNameColumn.trim())!;
  const balanceIndex = fieldIndex.get(mapping.balanceColumn.trim())!;
  const dateIndex = mapping.dateColumn ? fieldIndex.get(mapping.dateColumn.trim()) : undefined;
  const categoryIndex = mapping.categoryColumn
    ? fieldIndex.get(mapping.categoryColumn.trim())
    : undefined;
  const quantityIndex = mapping.quantityColumn
    ? fieldIndex.get(mapping.quantityColumn.trim())
    : undefined;

  const rows: AssetBalanceCsvRow[] = [];
  const skippedRows: AssetBalanceCsvSkip[] = [];

  for (let i = 1; i < csvRows.length; i++) {
    const cols = csvRows[i];
    const lineNumber = i + 1;
    const rawInstitution = cols[institutionIndex];
    const rawAssetName = cols[assetNameIndex];
    const rawBalance = cols[balanceIndex];

    if (!rawInstitution?.trim() || !rawAssetName?.trim() || !rawBalance?.trim()) {
      skippedRows.push({ lineNumber, reason: "必須項目(金融機関/資産名/残高)が空です" });
      continue;
    }

    const normalizedBalance = normalizeNumericString(rawBalance);
    if (!normalizedBalance) {
      skippedRows.push({ lineNumber, reason: `残高を解釈できません: "${rawBalance}"` });
      continue;
    }

    let snapshotDate: Date | null = null;
    if (dateIndex !== undefined) {
      const rawDate = cols[dateIndex];
      if (rawDate?.trim()) {
        snapshotDate = parseFlexibleDate(rawDate);
        if (!snapshotDate) {
          skippedRows.push({ lineNumber, reason: `日付を解釈できません: "${rawDate}"` });
          continue;
        }
      }
    }

    let quantity: Decimal | null = null;
    if (quantityIndex !== undefined) {
      const rawQuantity = cols[quantityIndex];
      if (rawQuantity?.trim()) {
        const normalizedQuantity = normalizeNumericString(rawQuantity);
        if (!normalizedQuantity) {
          skippedRows.push({ lineNumber, reason: `数量を解釈できません: "${rawQuantity}"` });
          continue;
        }
        quantity = new Decimal(normalizedQuantity);
      }
    }

    rows.push({
      snapshotDate,
      institution: rawInstitution.trim(),
      assetName: rawAssetName.trim(),
      category: categoryIndex !== undefined ? cols[categoryIndex]?.trim() || "" : "",
      balanceJpy: new Decimal(normalizedBalance),
      quantity,
    });
  }

  return { rows, skippedRows };
}
