import { Decimal } from "decimal.js";
import { parseCsvRows } from "../moneyforward/csv";
import type { CryptoTradeType } from "./calculator";

/**
 * 暗号資産取引所(bitFlyer/Coincheck/GMOコイン等)の「取引履歴」CSVエクスポートの取り込み。
 *
 * 各取引所のCSV仕様は非公開・変更されやすく、本ツールが全取引所の正確な列定義を
 * 常に追随することは難しい。そのため MoneyForward パーサーと同様に「よくある
 * 列見出し」をエイリアスとして幅広く登録し、日時・銘柄ペア・売買種別・数量・単価
 * (または合計金額)・手数料という共通の論理項目にマッピングする方式を採る。
 * 取引所ごとの専用パーサーを個別に用意するより、実際にエクスポートされたCSVで
 * ヘッダーが一致しない場合に少しずつエイリアスを追加していく方が現実的なため、
 * このファイルは1つの汎用パーサーとして育てていく(ロードマップ参照)。
 *
 * 対応範囲(初期版):
 *  - 円建ての現物売買(買い/売り)のみ。暗号資産同士の交換(TRADE_IN/TRADE_OUT)や
 *    マイニング等の受取(INCOME)はCSV取り込みでは未対応(手入力で対応)。
 *  - 手数料は円建てを前提とする。暗号資産建て手数料の取り込みは未対応。
 */

export interface ExchangeCryptoTradeRow {
  tradedAt: Date;
  symbol: string;
  type: Extract<CryptoTradeType, "BUY" | "SELL">;
  quantity: Decimal;
  unitPriceJpy: Decimal;
  feeJpy: Decimal;
}

export interface ExchangeCsvSkip {
  lineNumber: number;
  reason: string;
}

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
// 入出金など、取引ではない行を明確に区別してスキップ理由を出すための既知の値。
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

function parseDecimalAbs(value: string): Decimal | null {
  const normalized = value.replace(/,/g, "").trim();
  if (normalized === "") return new Decimal(0);
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return new Decimal(normalized).abs();
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
