import { Decimal } from "decimal.js";
import { normalizeNumericString, parseCsvRows, parseFlexibleDateTime } from "../csv";
import type { CryptoTradeType } from "./calculator";

/**
 * 暗号資産取引所が発行する取引履歴CSVの取り込み。
 *
 * 各取引所のCSV仕様は非公式(取引所が仕様変更する可能性がある)ため、
 * マネーフォワードのパーサーと同様に「解釈できない行はスキップして
 * 処理を継続し、理由を報告する」方針を取る。特に、税務上の扱いが
 * 一意に決まらない行(入出金・証拠金取引・増減の組み合わせが不明瞭な行など)は
 * 誤って課税イベントとして取り込むより、スキップして手動確認を促す方が安全。
 *
 * そのうえで、既知の取引所CSV向けプリセットに加えて、列名が一致しないCSV向けに
 * ユーザーがヘッダー名を指定する汎用マッピング方式も提供する。
 *
 * 対応取引所(2026年時点で確認できた仕様に基づく):
 *  - bitflyer: bitFlyer「お取引レポート」現物取引履歴CSV
 *  - coincheck: Coincheckの「業界標準フォーマット」CSV(JCBA参考フォーマット準拠)
 *  - gmo: GMOコイン取引履歴CSV(現物取引の行のみ。証拠金取引・入出金行は対象外)
 *  - bitbank: bitbank「約定履歴」CSV(現物取引の行のみ。信用取引行は対象外)
 *  - other: 手動マッピング専用
 *
 * DMM Bitcoin/SBI VCトレードの取引報告書CSV(TRADE_RECORD_LIST)は証拠金
 * (レバレッジ)取引専用で、決済時の「建玉損益」を課税所得とする方式のため、
 * 本ツールの現物取引モデル(数量×単価で取得費を積み上げる総平均法/移動平均法)
 * にはそのまま当てはめられない。誤った損益計算を避けるため現時点では未対応とし、
 * 別方式での対応を今後検討する(README「ロードマップ」参照)。
 */

export type ExchangeCsvPreset = "bitflyer" | "coincheck" | "gmo" | "bitbank" | "other";
type KnownExchangeCsvPreset = Exclude<ExchangeCsvPreset, "other">;

export const EXCHANGE_CSV_PRESETS: { value: KnownExchangeCsvPreset; label: string }[] = [
  { value: "bitflyer", label: "bitFlyer(現物取引履歴CSV)" },
  { value: "coincheck", label: "Coincheck(業界標準フォーマットCSV)" },
  { value: "gmo", label: "GMOコイン(取引履歴CSV・現物のみ)" },
  { value: "bitbank", label: "bitbank(約定履歴CSV・現物のみ)" },
];

const EXCHANGE_LABELS: Record<KnownExchangeCsvPreset, string> = {
  bitflyer: "bitFlyer",
  coincheck: "Coincheck",
  gmo: "GMOコイン",
  bitbank: "bitbank",
};

export interface ExchangeCsvMapping {
  dateColumn: string;
  symbolColumn: string;
  typeColumn: string;
  buyValue: string;
  sellValue: string;
  quantityColumn: string;
  unitPriceColumn: string;
  feeColumn?: string;
}

export interface ExchangeCsvRow {
  tradedAt: Date;
  symbol: string;
  type: CryptoTradeType;
  quantity: Decimal;
  unitPriceJpy: Decimal;
  feeJpy: Decimal;
  exchange?: string | null;
  memo?: string | null;
}

export interface ExchangeCsvSkip {
  lineNumber: number;
  reason: string;
}

export type ExchangeCsvParseSkip = ExchangeCsvSkip;

export interface ExchangeCsvParseResult {
  rows: ExchangeCsvRow[];
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
const JPY_SYMBOL = "JPY";

const BUY_VALUES = new Set(["買い", "買", "購入", "現物買", "buy", "BUY", "Buy"]);
const SELL_VALUES = new Set(["売り", "売", "売却", "現物売", "sell", "SELL", "Sell"]);
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

const BITFLYER_REQUIRED = ["取引日時", "取引種別", "通貨1", "通貨1数量", "取引価格"];
const COINCHECK_REQUIRED = ["取引日時", "増加通貨名", "減少通貨名"];
const GMO_REQUIRED = ["日時", "取引区分", "銘柄名", "売買区分", "約定数量", "約定レート"];
const BITBANK_REQUIRED = ["取引日時", "通貨ペア", "現物/信用", "売/買", "数量", "価格"];

function isKnownExchangeCsvPreset(preset: ExchangeCsvPreset): preset is KnownExchangeCsvPreset {
  return preset in EXCHANGE_LABELS;
}

function buildHeaderIndex(headerRow: string[]): Map<string, number> {
  const index = new Map<string, number>();
  headerRow.forEach((header, i) => {
    const key = header.trim();
    if (key && !index.has(key)) index.set(key, i);
  });
  return index;
}

function cell(cols: string[], index: Map<string, number>, header: string): string | undefined {
  const i = index.get(header);
  if (i === undefined) return undefined;
  return cols[i]?.trim();
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

function parseDecimalAbs(value: string | undefined): Decimal | null {
  const parsed = parseDecimalStrict(value);
  return parsed ? parsed.abs() : value?.trim() === "" ? new Decimal(0) : null;
}

function parseSide(raw: string): "BUY" | "SELL" | "NON_TRADE" | null {
  const trimmed = raw.trim();
  if (BUY_VALUES.has(trimmed)) return "BUY";
  if (SELL_VALUES.has(trimmed)) return "SELL";
  if (NON_TRADE_VALUES.has(trimmed)) return "NON_TRADE";
  return null;
}

function extractJpySymbol(raw: string): string | null {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;

  const parts = trimmed.split(/[_/\-]/).filter((p) => p.length > 0);
  if (parts.length === 1) {
    return parts[0] === JPY_SYMBOL ? null : parts[0];
  }
  if (parts.length === 2) {
    const [a, b] = parts;
    if (a === JPY_SYMBOL && b !== JPY_SYMBOL) return b;
    if (b === JPY_SYMBOL && a !== JPY_SYMBOL) return a;
    return null;
  }
  return null;
}

export function parseExchangeCsv(
  preset: ExchangeCsvPreset,
  csvText: string,
): ExchangeCsvParseResult;
export function parseExchangeCsv(
  csvText: string,
  mapping: ExchangeCsvMapping,
): ExchangeCsvParseResult;
export function parseExchangeCsv(
  arg1: string,
  arg2: string | ExchangeCsvMapping,
): ExchangeCsvParseResult {
  if (typeof arg2 === "string") {
    const preset = arg1 as ExchangeCsvPreset;
    if (!isKnownExchangeCsvPreset(preset)) {
      throw new Error("このプリセットでは取り込めません。列名を指定して手動マッピングしてください");
    }
    switch (preset) {
      case "bitflyer":
        return parseBitflyerCsv(arg2);
      case "coincheck":
        return parseCoincheckCsv(arg2);
      case "gmo":
        return parseGmoCoinCsv(arg2);
      case "bitbank":
        return parseBitbankCsv(arg2);
    }
  }
  return parseMappedExchangeCsv(arg1, arg2);
}

function parseMappedExchangeCsv(
  csvText: string,
  mapping: ExchangeCsvMapping,
): ExchangeCsvParseResult {
  const csvRows = parseCsvRows(csvText);
  if (csvRows.length === 0) {
    return { rows: [], skippedRows: [] };
  }

  const headerRow = csvRows[0];
  const fieldIndex = buildHeaderIndex(headerRow);
  const requiredColumns: [string, string][] = [
    ["日付", mapping.dateColumn],
    ["銘柄", mapping.symbolColumn],
    ["売買種別", mapping.typeColumn],
    ["数量", mapping.quantityColumn],
    ["単価", mapping.unitPriceColumn],
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
  const typeIndex = fieldIndex.get(mapping.typeColumn.trim())!;
  const quantityIndex = fieldIndex.get(mapping.quantityColumn.trim())!;
  const unitPriceIndex = fieldIndex.get(mapping.unitPriceColumn.trim())!;
  const feeIndex = mapping.feeColumn ? fieldIndex.get(mapping.feeColumn.trim()) : undefined;

  const buyValue = mapping.buyValue.trim().toLowerCase();
  const sellValue = mapping.sellValue.trim().toLowerCase();
  const rows: ExchangeCsvRow[] = [];
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

    const quantity = parseDecimalStrict(rawQuantity);
    if (!quantity || quantity.isZero()) {
      skippedRows.push({ lineNumber, reason: `数量を解釈できません: "${rawQuantity}"` });
      continue;
    }

    const unitPriceJpy = parseDecimalStrict(rawUnitPrice);
    if (!unitPriceJpy) {
      skippedRows.push({ lineNumber, reason: `単価を解釈できません: "${rawUnitPrice}"` });
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

    rows.push({
      tradedAt,
      symbol: rawSymbol.trim().toUpperCase(),
      type,
      quantity: quantity.abs(),
      unitPriceJpy: unitPriceJpy.abs(),
      feeJpy,
      memo: null,
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

  const missingRequired = REQUIRED_FIELDS.filter((field) => !fieldIndex.has(field));
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

  const rows: ExchangeCsvRow[] = [];
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
      skippedRows.push({ lineNumber, reason: `売買種別を解釈できません: "${rawSide}"` });
      continue;
    }
    if (side === "NON_TRADE") {
      skippedRows.push({
        lineNumber,
        reason: `入出金など取引以外の行は未対応のためスキップしました: "${rawSide}"`,
      });
      continue;
    }

    const tradedAt = parseFlexibleDate(rawDate);
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
      skippedRows.push({ lineNumber, reason: `数量を解釈できません: "${rawQuantity}"` });
      continue;
    }

    const rawFee = get(cols, "fee");
    const feeJpy = rawFee !== undefined ? parseDecimalAbs(rawFee) : new Decimal(0);
    if (feeJpy === null) {
      skippedRows.push({ lineNumber, reason: `手数料を解釈できません: "${rawFee}"` });
      continue;
    }

    const rawUnitPrice = get(cols, "unitPrice");
    let unitPriceJpy: Decimal | null = null;
    if (rawUnitPrice !== undefined && rawUnitPrice.trim() !== "") {
      unitPriceJpy = parseDecimalAbs(rawUnitPrice);
      if (!unitPriceJpy) {
        skippedRows.push({ lineNumber, reason: `単価を解釈できません: "${rawUnitPrice}"` });
        continue;
      }
    } else {
      const total = parseDecimalAbs(get(cols, "totalValue"));
      if (!total) {
        skippedRows.push({ lineNumber, reason: "単価・合計金額のいずれも解釈できません" });
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
      feeJpy,
      memo: null,
    });
  }

  return { rows, skippedRows };
}

function parseBitflyerCsv(csvText: string): ExchangeCsvParseResult {
  const csvRows = parseCsvRows(csvText);
  if (csvRows.length === 0) return { rows: [], skippedRows: [] };

  const index = buildHeaderIndex(csvRows[0]);
  const missing = BITFLYER_REQUIRED.filter((h) => !index.has(h));
  if (missing.length > 0) {
    throw new Error(
      `bitFlyerのCSV形式として認識できませんでした。不足しているカラム: ${missing.join(", ")}`,
    );
  }

  const rows: ExchangeCsvRow[] = [];
  const skippedRows: ExchangeCsvSkip[] = [];

  for (let i = 1; i < csvRows.length; i++) {
    const cols = csvRows[i];
    const lineNumber = i + 1;
    const get = (h: string) => cell(cols, index, h);

    const tradeType = get("取引種別") ?? "";
    let type: CryptoTradeType;
    if (tradeType.includes("買")) {
      type = "BUY";
    } else if (tradeType.includes("売")) {
      type = "SELL";
    } else {
      skippedRows.push({
        lineNumber,
        reason: `現物売買以外の取引種別のため対象外です: "${tradeType}"`,
      });
      continue;
    }

    const symbol = (get("通貨1") ?? "").toUpperCase();
    const quantityStr = normalizeNumericString(get("通貨1数量"));
    const priceStr = normalizeNumericString(get("取引価格"));
    const tradedAt = parseFlexibleDate(get("取引日時"));
    if (!symbol || !quantityStr || !priceStr || !tradedAt) {
      skippedRows.push({ lineNumber, reason: "日時・銘柄・数量・単価のいずれかを解釈できません" });
      continue;
    }

    const quantity = new Decimal(quantityStr).abs();
    if (quantity.isZero()) {
      skippedRows.push({ lineNumber, reason: "数量が0です" });
      continue;
    }

    const feeCryptoStr = normalizeNumericString(get("手数料"));
    const jpyRateStr = normalizeNumericString(get("通貨1の対円レート"));
    let feeJpy = new Decimal(0);
    if (feeCryptoStr) {
      const feeCrypto = new Decimal(feeCryptoStr).abs();
      const jpyRate = jpyRateStr ? new Decimal(jpyRateStr) : new Decimal(priceStr);
      feeJpy = feeCrypto.times(jpyRate);
    }

    rows.push({
      tradedAt,
      symbol,
      type,
      quantity,
      unitPriceJpy: new Decimal(priceStr).abs(),
      feeJpy,
      exchange: EXCHANGE_LABELS.bitflyer,
      memo: get("備考") || null,
    });
  }

  return { rows, skippedRows };
}

function parseCoincheckCsv(csvText: string): ExchangeCsvParseResult {
  const csvRows = parseCsvRows(csvText);
  if (csvRows.length === 0) return { rows: [], skippedRows: [] };

  const index = buildHeaderIndex(csvRows[0]);
  const missing = COINCHECK_REQUIRED.filter((h) => !index.has(h));
  if (missing.length > 0) {
    throw new Error(
      `Coincheckの業界標準フォーマットCSVとして認識できませんでした。不足しているカラム: ${missing.join(", ")}`,
    );
  }

  const rows: ExchangeCsvRow[] = [];
  const skippedRows: ExchangeCsvSkip[] = [];

  for (let i = 1; i < csvRows.length; i++) {
    const cols = csvRows[i];
    const lineNumber = i + 1;
    const get = (h: string) => cell(cols, index, h);

    const sendFrom = get("送付元アドレス");
    const sendTo = get("送付先アドレス");
    if (sendFrom || sendTo) {
      skippedRows.push({ lineNumber, reason: "入出金(送付・受取)のため対象外です" });
      continue;
    }

    const tradedAt = parseFlexibleDate(get("取引日時"));
    const increaseSymbol = (get("増加通貨名") ?? "").toUpperCase() || null;
    const decreaseSymbol = (get("減少通貨名") ?? "").toUpperCase() || null;
    const increaseQtyStr = normalizeNumericString(get("増加数量"));
    const decreaseQtyStr = normalizeNumericString(get("減少数量"));
    const settlementStr = normalizeNumericString(get("約定代金"));
    const priceStr = normalizeNumericString(get("約定価格"));

    if (!tradedAt) {
      skippedRows.push({
        lineNumber,
        reason: `取引日時を解釈できません: "${get("取引日時") ?? ""}"`,
      });
      continue;
    }

    if (!increaseSymbol || !decreaseSymbol || !increaseQtyStr || !decreaseQtyStr) {
      skippedRows.push({
        lineNumber,
        reason: "増加・減少の一方のみの明細のため取込対象外です(報酬受取・手数料等は手動で登録してください)",
      });
      continue;
    }

    const increaseQty = new Decimal(increaseQtyStr).abs();
    const decreaseQty = new Decimal(decreaseQtyStr).abs();
    const settlement = settlementStr ? new Decimal(settlementStr).abs() : null;
    const feeJpy = resolveCoincheckFeeJpy(get, index);
    const memo = get("備考") || null;

    if (increaseSymbol === JPY_SYMBOL && decreaseSymbol !== JPY_SYMBOL) {
      const unitPrice = priceStr ? new Decimal(priceStr).abs() : increaseQty.dividedBy(decreaseQty);
      rows.push({
        tradedAt,
        symbol: decreaseSymbol,
        type: "SELL",
        quantity: decreaseQty,
        unitPriceJpy: unitPrice,
        feeJpy,
        exchange: EXCHANGE_LABELS.coincheck,
        memo,
      });
    } else if (decreaseSymbol === JPY_SYMBOL && increaseSymbol !== JPY_SYMBOL) {
      const unitPrice = priceStr ? new Decimal(priceStr).abs() : decreaseQty.dividedBy(increaseQty);
      rows.push({
        tradedAt,
        symbol: increaseSymbol,
        type: "BUY",
        quantity: increaseQty,
        unitPriceJpy: unitPrice,
        feeJpy,
        exchange: EXCHANGE_LABELS.coincheck,
        memo,
      });
    } else if (increaseSymbol !== JPY_SYMBOL && decreaseSymbol !== JPY_SYMBOL) {
      const jpyValue = settlement ?? (priceStr ? new Decimal(priceStr).abs().times(decreaseQty) : null);
      if (!jpyValue) {
        skippedRows.push({
          lineNumber,
          reason: "暗号資産同士の交換で円換算額(約定代金/約定価格)を解釈できません",
        });
        continue;
      }
      rows.push({
        tradedAt,
        symbol: decreaseSymbol,
        type: "TRADE_OUT",
        quantity: decreaseQty,
        unitPriceJpy: jpyValue.dividedBy(decreaseQty),
        feeJpy,
        exchange: EXCHANGE_LABELS.coincheck,
        memo,
      });
      rows.push({
        tradedAt,
        symbol: increaseSymbol,
        type: "TRADE_IN",
        quantity: increaseQty,
        unitPriceJpy: jpyValue.dividedBy(increaseQty),
        feeJpy: new Decimal(0),
        exchange: EXCHANGE_LABELS.coincheck,
        memo,
      });
    } else {
      skippedRows.push({ lineNumber, reason: "増加・減少通貨の組み合わせを解釈できません" });
    }
  }

  return { rows, skippedRows };
}

function resolveCoincheckFeeJpy(
  get: (h: string) => string | undefined,
  index: Map<string, number>,
): Decimal {
  if (!index.has("手数料通貨") || !index.has("手数料数量")) return new Decimal(0);
  const feeCurrency = (get("手数料通貨") ?? "").toUpperCase();
  const feeQtyStr = normalizeNumericString(get("手数料数量"));
  if (!feeQtyStr || feeCurrency !== JPY_SYMBOL) return new Decimal(0);
  return new Decimal(feeQtyStr).abs();
}

function parseGmoCoinCsv(csvText: string): ExchangeCsvParseResult {
  const csvRows = parseCsvRows(csvText);
  if (csvRows.length === 0) return { rows: [], skippedRows: [] };

  const index = buildHeaderIndex(csvRows[0]);
  const missing = GMO_REQUIRED.filter((h) => !index.has(h));
  if (missing.length > 0) {
    throw new Error(
      `GMOコインのCSV形式として認識できませんでした。不足しているカラム: ${missing.join(", ")}`,
    );
  }

  const rows: ExchangeCsvRow[] = [];
  const skippedRows: ExchangeCsvSkip[] = [];

  for (let i = 1; i < csvRows.length; i++) {
    const cols = csvRows[i];
    const lineNumber = i + 1;
    const get = (h: string) => cell(cols, index, h);

    const category = get("取引区分") ?? "";
    if (!category.includes("現物")) {
      skippedRows.push({
        lineNumber,
        reason: `現物取引以外(証拠金取引・入出金等)のため対象外です: "${category || "(空欄)"}"`,
      });
      continue;
    }

    const side = get("売買区分") ?? "";
    let type: CryptoTradeType;
    if (side.includes("買")) {
      type = "BUY";
    } else if (side.includes("売")) {
      type = "SELL";
    } else {
      skippedRows.push({ lineNumber, reason: `売買区分を解釈できません: "${side}"` });
      continue;
    }

    const symbol = (get("銘柄名") ?? "").toUpperCase().replace(/_?JPY$/, "");
    const quantityStr = normalizeNumericString(get("約定数量"));
    const priceStr = normalizeNumericString(get("約定レート"));
    const tradedAt = parseFlexibleDate(get("日時"));
    if (!symbol || !quantityStr || !priceStr || !tradedAt) {
      skippedRows.push({ lineNumber, reason: "日時・銘柄・数量・単価のいずれかを解釈できません" });
      continue;
    }

    const quantity = new Decimal(quantityStr).abs();
    if (quantity.isZero()) {
      skippedRows.push({ lineNumber, reason: "数量が0です" });
      continue;
    }

    const feeStr = normalizeNumericString(get("注文手数料"));
    rows.push({
      tradedAt,
      symbol,
      type,
      quantity,
      unitPriceJpy: new Decimal(priceStr).abs(),
      feeJpy: feeStr ? new Decimal(feeStr).abs() : new Decimal(0),
      exchange: EXCHANGE_LABELS.gmo,
      memo: null,
    });
  }

  return { rows, skippedRows };
}

/**
 * bitbank「約定履歴」CSV(ファイル名例: user_spot_trades_*.csv)のパーサー。
 *
 * ヘッダー: 注文id,取引id,通貨ペア,現物/信用,タイプ,売/買,数量,価格,実現損益,
 *           発生手数料,実現手数料,実現利息,m/t,取引日時
 *
 * 「現物/信用」が"現物"の行のみを対象にし、信用取引(レバレッジ)行は対象外とする。
 * 手数料(発生手数料)はメイカー報酬で負値になることがあるため、負値は0円として扱う
 * (メイカー報酬は本来雑所得の収入になるが、金額が小さく複雑になるため現状は
 * 手動での追加調整を前提とする)。
 */
function parseBitbankCsv(csvText: string): ExchangeCsvParseResult {
  const csvRows = parseCsvRows(csvText);
  if (csvRows.length === 0) return { rows: [], skippedRows: [] };

  const index = buildHeaderIndex(csvRows[0]);
  const missing = BITBANK_REQUIRED.filter((h) => !index.has(h));
  if (missing.length > 0) {
    throw new Error(
      `bitbankの約定履歴CSV形式として認識できませんでした。不足しているカラム: ${missing.join(", ")}`,
    );
  }

  const rows: ExchangeCsvRow[] = [];
  const skippedRows: ExchangeCsvSkip[] = [];

  for (let i = 1; i < csvRows.length; i++) {
    const cols = csvRows[i];
    const lineNumber = i + 1;
    const get = (h: string) => cell(cols, index, h);

    const category = get("現物/信用") ?? "";
    if (category !== "現物") {
      skippedRows.push({
        lineNumber,
        reason: `現物取引以外(信用取引等)のため対象外です: "${category || "(空欄)"}"`,
      });
      continue;
    }

    const side = get("売/買") ?? "";
    let type: CryptoTradeType;
    if (side.includes("買")) {
      type = "BUY";
    } else if (side.includes("売")) {
      type = "SELL";
    } else {
      skippedRows.push({ lineNumber, reason: `売買区分を解釈できません: "${side}"` });
      continue;
    }

    const symbol = (get("通貨ペア") ?? "").toUpperCase().replace(/[-_/]?JPY$/i, "");
    const quantityStr = normalizeNumericString(get("数量"));
    const priceStr = normalizeNumericString(get("価格"));
    const tradedAt = parseFlexibleDate(get("取引日時"));
    if (!symbol || !quantityStr || !priceStr || !tradedAt) {
      skippedRows.push({ lineNumber, reason: "日時・通貨ペア・数量・価格のいずれかを解釈できません" });
      continue;
    }

    const quantity = new Decimal(quantityStr).abs();
    if (quantity.isZero()) {
      skippedRows.push({ lineNumber, reason: "数量が0です" });
      continue;
    }

    const feeStr = normalizeNumericString(get("発生手数料"));
    const fee = feeStr ? new Decimal(feeStr) : new Decimal(0);

    rows.push({
      tradedAt,
      symbol,
      type,
      quantity,
      unitPriceJpy: new Decimal(priceStr).abs(),
      feeJpy: fee.isPositive() ? fee : new Decimal(0),
      exchange: EXCHANGE_LABELS.bitbank,
      memo: null,
    });
  }

  return { rows, skippedRows };
}
