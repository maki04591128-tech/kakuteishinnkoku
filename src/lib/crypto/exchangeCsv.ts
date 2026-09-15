import { Decimal } from "decimal.js";
import { parseCsvRows } from "../moneyforward/csv";

/**
 * 暗号資産取引所からダウンロードした取引履歴CSVの取り込み。
 *
 * bitFlyer・Coincheck・GMOコイン等、取引所ごとにCSVの列構成(列名・列順)が
 * 異なる上、各社とも仕様変更が入るため、特定の取引所専用パーサーを個別に
 * 実装すると壊れやすい。そこで、ユーザーが自分のCSVの1行目(ヘッダー)を見て
 * 「どの列が日付か」「どの列が売買種別か」等を指定する汎用マッピング方式を
 * 採用する。指定された列名がCSVに存在しない・値を解釈できない行は
 * (マネーフォワード取り込みと同様に)スキップして理由を記録し、
 * 全体の取り込みを中断しない。
 *
 * 対応する取引種別は買い(BUY)・売り(SELL)の現物取引のみ。暗号資産同士の
 * 交換やマイニング等の受取は、取り込み後に手動で追加する。
 */

export interface ExchangeCsvMapping {
  /** 取引日時が入っている列のヘッダー名 */
  dateColumn: string;
  /** 銘柄(BTC等)が入っている列のヘッダー名 */
  symbolColumn: string;
  /** 売買種別が入っている列のヘッダー名 */
  typeColumn: string;
  /** typeColumn の値が買いを表すときの文字列(前後空白無視・大文字小文字区別なし) */
  buyValue: string;
  /** typeColumn の値が売りを表すときの文字列(前後空白無視・大文字小文字区別なし) */
  sellValue: string;
  /** 数量が入っている列のヘッダー名 */
  quantityColumn: string;
  /** 単価(円)が入っている列のヘッダー名 */
  unitPriceColumn: string;
  /** 手数料(円)が入っている列のヘッダー名(任意) */
  feeColumn?: string;
  /** 取引所名として全行に付与する固定値(任意) */
  exchangeName?: string;
}

export interface ExchangeCsvRow {
  tradedAt: Date;
  symbol: string;
  type: "BUY" | "SELL";
  quantity: Decimal;
  unitPriceJpy: Decimal;
  feeJpy: Decimal;
}

export interface ExchangeCsvParseSkip {
  lineNumber: number;
  reason: string;
}

export interface ExchangeCsvParseResult {
  rows: ExchangeCsvRow[];
  skippedRows: ExchangeCsvParseSkip[];
}

function normalizeHeader(value: string): string {
  return value.trim();
}

function parseFlexibleDate(value: string): Date | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  // YYYY/MM/DD, YYYY-MM-DD の日付部分 + 任意の "T" or 半角スペース区切りの時刻
  const match = trimmed.match(
    /^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (match) {
    const [, y, m, d, h, min, sec] = match;
    const date = new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      h ? Number(h) : 0,
      min ? Number(min) : 0,
      sec ? Number(sec) : 0,
    );
    if (!Number.isNaN(date.getTime())) return date;
  }

  // ISO8601 (Zタイムゾーン等) やその他ブラウザ/Node標準で解釈できる形式のフォールバック
  const fallback = new Date(trimmed);
  if (!Number.isNaN(fallback.getTime())) return fallback;

  return null;
}

function parseDecimalLoose(value: string): Decimal | null {
  const normalized = value.replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return new Decimal(normalized);
}

export function parseExchangeCsv(
  csvText: string,
  mapping: ExchangeCsvMapping,
): ExchangeCsvParseResult {
  const csvRows = parseCsvRows(csvText);
  if (csvRows.length === 0) {
    return { rows: [], skippedRows: [] };
  }

  const headerRow = csvRows[0];
  const fieldIndex = new Map<string, number>();
  headerRow.forEach((header, index) => {
    fieldIndex.set(normalizeHeader(header), index);
  });

  const requiredColumns: [string, string][] = [
    ["日付", mapping.dateColumn],
    ["銘柄", mapping.symbolColumn],
    ["売買種別", mapping.typeColumn],
    ["数量", mapping.quantityColumn],
    ["単価", mapping.unitPriceColumn],
  ];
  const missing = requiredColumns.filter(
    ([, column]) => !fieldIndex.has(normalizeHeader(column)),
  );
  if (missing.length > 0) {
    throw new Error(
      `指定された列名がCSVに見つかりませんでした: ${missing
        .map(([label, column]) => `${label}=「${column}」`)
        .join(", ")}`,
    );
  }

  const dateIndex = fieldIndex.get(normalizeHeader(mapping.dateColumn))!;
  const symbolIndex = fieldIndex.get(normalizeHeader(mapping.symbolColumn))!;
  const typeIndex = fieldIndex.get(normalizeHeader(mapping.typeColumn))!;
  const quantityIndex = fieldIndex.get(normalizeHeader(mapping.quantityColumn))!;
  const unitPriceIndex = fieldIndex.get(normalizeHeader(mapping.unitPriceColumn))!;
  const feeIndex = mapping.feeColumn
    ? fieldIndex.get(normalizeHeader(mapping.feeColumn))
    : undefined;

  const buyValue = mapping.buyValue.trim().toLowerCase();
  const sellValue = mapping.sellValue.trim().toLowerCase();

  const rows: ExchangeCsvRow[] = [];
  const skippedRows: ExchangeCsvParseSkip[] = [];

  for (let i = 1; i < csvRows.length; i++) {
    const cols = csvRows[i];
    const lineNumber = i + 1;

    const rawDate = cols[dateIndex];
    const rawSymbol = cols[symbolIndex];
    const rawType = cols[typeIndex];
    const rawQuantity = cols[quantityIndex];
    const rawUnitPrice = cols[unitPriceIndex];

    if (!rawDate || !rawSymbol || !rawType || !rawQuantity || !rawUnitPrice) {
      skippedRows.push({ lineNumber, reason: "必須項目が空です" });
      continue;
    }

    const tradedAt = parseFlexibleDate(rawDate);
    if (!tradedAt) {
      skippedRows.push({ lineNumber, reason: `日付を解釈できません: "${rawDate}"` });
      continue;
    }

    const normalizedType = rawType.trim().toLowerCase();
    let type: "BUY" | "SELL";
    if (normalizedType === buyValue) {
      type = "BUY";
    } else if (normalizedType === sellValue) {
      type = "SELL";
    } else {
      skippedRows.push({
        lineNumber,
        reason: `売買種別を解釈できません(買い="${mapping.buyValue}"/売り="${mapping.sellValue}"と一致しません): "${rawType}"`,
      });
      continue;
    }

    const quantity = parseDecimalLoose(rawQuantity);
    if (!quantity || quantity.isZero()) {
      skippedRows.push({ lineNumber, reason: `数量を解釈できません: "${rawQuantity}"` });
      continue;
    }

    const unitPriceJpy = parseDecimalLoose(rawUnitPrice);
    if (!unitPriceJpy) {
      skippedRows.push({ lineNumber, reason: `単価を解釈できません: "${rawUnitPrice}"` });
      continue;
    }

    let feeJpy = new Decimal(0);
    if (feeIndex !== undefined) {
      const rawFee = cols[feeIndex];
      if (rawFee && rawFee.trim() !== "") {
        const parsedFee = parseDecimalLoose(rawFee);
        if (parsedFee === null) {
          skippedRows.push({ lineNumber, reason: `手数料を解釈できません: "${rawFee}"` });
          continue;
        }
        feeJpy = parsedFee.abs();
      }
    }

    rows.push({
      tradedAt,
      symbol: rawSymbol.trim().toUpperCase(),
      type,
      quantity: quantity.abs(),
      unitPriceJpy: unitPriceJpy.abs(),
      feeJpy,
    });
  }

  return { rows, skippedRows };
}
