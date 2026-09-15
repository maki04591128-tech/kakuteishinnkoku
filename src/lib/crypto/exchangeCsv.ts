import { Decimal } from "decimal.js";
import { parseCsvRows } from "../moneyforward/csv";
import type { CryptoTradeType } from "./calculator";

/**
 * 暗号資産取引所(bitFlyer/Coincheck/GMOコイン等)の「取引履歴」CSVエクスポートの取り込み。
 *
 * 各取引所のCSV仕様は非公開・変更されやすく、本ツールが全取引所の正確な列定義を
 * 常に追随することは難しい。そのため、よくある列見出しをエイリアスとして登録した
 * 自動判定パーサーに加え、列名が一致しないCSV向けにユーザーがヘッダー名を指定する
 * 汎用マッピング方式も提供する。
 *
 * 対応範囲(初期版):
 *  - 円建ての現物売買(買い/売り)のみ。暗号資産同士の交換(TRADE_IN/TRADE_OUT)や
 *    マイニング等の受取(INCOME)はCSV取り込みでは未対応(手入力で対応)。
 *  - 手数料は円建てを前提とする。暗号資産建て手数料の取り込みは未対応。
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
}

export interface ExchangeCryptoTradeRow {
  tradedAt: Date;
  symbol: string;
  type: Extract<CryptoTradeType, "BUY" | "SELL">;
  quantity: Decimal;
  unitPriceJpy: Decimal;
  feeJpy: Decimal;
}

export type ExchangeCsvRow = ExchangeCryptoTradeRow;

export interface ExchangeCsvSkip {
  lineNumber: number;
  reason: string;
}

export type ExchangeCsvParseSkip = ExchangeCsvSkip;

export interface ExchangeCsvParseResult {
  rows: ExchangeCryptoTradeRow[];
  skippedRows: ExchangeCsvSkip[];
}

type LogicalField =
  | "date"
  | "pair"
  | "side"
  | "quantity"
  | "unitPrice"
  | "totalValue"
  | "fee";

// 列見出し(トリム済み)から論理項目へのエイリアス。
// bitFlyer/Coincheck/GMOコイン等、複数の取引所で見られる表記を集約している。
const HEADER_ALIASES: Record<string, LogicalField> = {
  約定日時: "date",
  取引日時: "date",
  日時: "date",
  日付: "date",
  "Trade Date": "date",
  Date: "date",
  商品: "pair",
  銘柄: "pair",
  通貨ペア: "pair",
  ペア: "pair",
  通貨: "pair",
  Product: "pair",
  Pair: "pair",
  Currency: "pair",
  売買: "side",
  取引種別: "side",
  種別: "side",
  注文タイプ: "side",
  取引区分: "side",
  Side: "side",
  "Trade Type": "side",
  約定数量: "quantity",
  数量: "quantity",
  量: "quantity",
  Amount: "quantity",
  Quantity: "quantity",
  約定レート: "unitPrice",
  約定価格: "unitPrice",
  約定単価: "unitPrice",
  単価: "unitPrice",
  レート: "unitPrice",
  Price: "unitPrice",
  Rate: "unitPrice",
  約定代金: "totalValue",
  合計: "totalValue",
  合計金額: "totalValue",
  受渡金額: "totalValue",
  Total: "totalValue",
  手数料: "fee",
  支払手数料: "fee",
  取引手数料: "fee",
  Fee: "fee",
};

const REQUIRED_FIELDS: LogicalField[] = ["date", "pair", "side", "quantity"];

const BUY_VALUES = new Set([
  "買い",
  "買",
  "購入",
  "現物買",
  "buy",
  "BUY",
  "Buy",
]);
const SELL_VALUES = new Set([
  "売り",
  "売",
  "売却",
  "現物売",
  "sell",
  "SELL",
  "Sell",
]);
const NON_TRADE_VALUES = new Set([
  "入金",
  "出金",
  "預入",
  "送付",
  "受取",
  "貸付",
  "貸付解除",
  "deposit",
  "withdrawal",
  "Deposit",
  "Withdrawal",
]);

function normalizeHeader(value: string): string {
  return value.trim();
}

function parseFlexibleDate(value: string): Date | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

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

  const fallback = new Date(trimmed);
  if (!Number.isNaN(fallback.getTime())) return fallback;

  return null;
}

function parseDateTime(value: string): Date | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const match = trimmed.match(
    /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/,
  );
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    h ? Number(h) : 0,
    mi ? Number(mi) : 0,
    s ? Number(s) : 0,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDecimalLoose(value: string): Decimal | null {
  const normalized = value.replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return new Decimal(normalized);
}

function parseDecimalAbs(value: string): Decimal | null {
  const normalized = value.replace(/,/g, "").trim();
  if (normalized === "") return new Decimal(0);
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return new Decimal(normalized).abs();
}

function parseSide(raw: string): "BUY" | "SELL" | "NON_TRADE" | null {
  const trimmed = raw.trim();
  if (BUY_VALUES.has(trimmed)) return "BUY";
  if (SELL_VALUES.has(trimmed)) return "SELL";
  if (NON_TRADE_VALUES.has(trimmed)) return "NON_TRADE";
  return null;
}

/**
 * 通貨ペア表記から円建ての銘柄シンボルを抽出する。
 * "BTC_JPY" / "BTC/JPY" / "BTC-JPY" のような表記からはJPY以外の側を返し、
 * セパレータの無い "BTC" のような表記はそのまま円建てとみなす。
 * JPY以外の通貨とのペア(暗号資産同士の交換)は現状未対応のため null を返す。
 */
function extractJpySymbol(raw: string): string | null {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;

  const parts = trimmed.split(/[_/\-]/).filter((p) => p.length > 0);
  if (parts.length === 1) {
    return parts[0] === "JPY" ? null : parts[0];
  }
  if (parts.length === 2) {
    const [a, b] = parts;
    if (a === "JPY" && b !== "JPY") return b;
    if (b === "JPY" && a !== "JPY") return a;
    return null;
  }
  return null;
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

  const rows: ExchangeCryptoTradeRow[] = [];
  const skippedRows: ExchangeCsvSkip[] = [];

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

export function parseCryptoExchangeCsv(csvText: string): ExchangeCsvParseResult {
  const csvRows = parseCsvRows(csvText);
  if (csvRows.length === 0) {
    return { rows: [], skippedRows: [] };
  }

  const headerRow = csvRows[0];
  const fieldIndex = new Map<LogicalField, number>();
  headerRow.forEach((header, index) => {
    const key = HEADER_ALIASES[header.trim()];
    if (key && !fieldIndex.has(key)) fieldIndex.set(key, index);
  });

  const missingRequired = REQUIRED_FIELDS.filter((f) => !fieldIndex.has(f));
  if (missingRequired.length > 0) {
    throw new Error(
      `取引所CSVの形式として認識できませんでした。不足しているカラム: ${missingRequired.join(", ")}`,
    );
  }
  if (!fieldIndex.has("unitPrice") && !fieldIndex.has("totalValue")) {
    throw new Error(
      "取引所CSVの形式として認識できませんでした。単価または合計金額のカラムが見つかりません",
    );
  }

  const get = (cols: string[], key: LogicalField): string | undefined => {
    const index = fieldIndex.get(key);
    if (index === undefined) return undefined;
    return cols[index];
  };

  const rows: ExchangeCryptoTradeRow[] = [];
  const skippedRows: ExchangeCsvSkip[] = [];

  for (let i = 1; i < csvRows.length; i++) {
    const cols = csvRows[i];
    const lineNumber = i + 1;

    const rawDate = get(cols, "date");
    const rawPair = get(cols, "pair");
    const rawSide = get(cols, "side");
    const rawQuantity = get(cols, "quantity");

    if (!rawDate || !rawPair || !rawSide || !rawQuantity) {
      skippedRows.push({
        lineNumber,
        reason: "必須項目(日時/銘柄/売買種別/数量)が空です",
      });
      continue;
    }

    const side = parseSide(rawSide);
    if (side === null) {
      skippedRows.push({
        lineNumber,
        reason: `売買種別を解釈できません: "${rawSide}"`,
      });
      continue;
    }
    if (side === "NON_TRADE") {
      skippedRows.push({
        lineNumber,
        reason: `入出金など取引以外の行は未対応のためスキップしました: "${rawSide}"`,
      });
      continue;
    }

    const tradedAt = parseDateTime(rawDate);
    if (!tradedAt) {
      skippedRows.push({ lineNumber, reason: `日時を解釈できません: "${rawDate}"` });
      continue;
    }

    const symbol = extractJpySymbol(rawPair);
    if (!symbol) {
      skippedRows.push({
        lineNumber,
        reason: `円建て以外の通貨ペアは現状未対応です: "${rawPair}"`,
      });
      continue;
    }

    const quantity = parseDecimalAbs(rawQuantity);
    if (!quantity || quantity.isZero()) {
      skippedRows.push({
        lineNumber,
        reason: `数量を解釈できません: "${rawQuantity}"`,
      });
      continue;
    }

    const rawFee = get(cols, "fee");
    const fee = rawFee !== undefined ? parseDecimalAbs(rawFee) : new Decimal(0);
    if (fee === null) {
      skippedRows.push({ lineNumber, reason: `手数料を解釈できません: "${rawFee}"` });
      continue;
    }

    const rawUnitPrice = get(cols, "unitPrice");
    let unitPriceJpy: Decimal | null = null;
    if (rawUnitPrice !== undefined && rawUnitPrice.trim() !== "") {
      unitPriceJpy = parseDecimalAbs(rawUnitPrice);
      if (!unitPriceJpy) {
        skippedRows.push({
          lineNumber,
          reason: `単価を解釈できません: "${rawUnitPrice}"`,
        });
        continue;
      }
    } else {
      const rawTotal = get(cols, "totalValue");
      const total = rawTotal !== undefined ? parseDecimalAbs(rawTotal) : null;
      if (!total) {
        skippedRows.push({
          lineNumber,
          reason: "単価・合計金額のいずれも解釈できません",
        });
        continue;
      }
      unitPriceJpy = total.dividedBy(quantity);
    }

    rows.push({
      tradedAt,
      symbol,
      type: side,
      quantity,
      unitPriceJpy,
      feeJpy: fee,
    });
  }

  return { rows, skippedRows };
}
