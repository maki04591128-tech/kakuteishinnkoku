import { Decimal } from "decimal.js";
import { parseCsvRows } from "../moneyforward/csv";
import type { CryptoTradeType } from "./calculator";

/**
 * 暗号資産取引所の取引履歴CSVインポート。
 *
 * 各取引所はCSVのフォーマットが異なるため、取引所ごとに専用のパーサーを
 * 用意する。ヘッダー名でカラムを特定するmoneyforward/parseCashflow.tsと
 * 同じ方針を踏襲し、列順の変化には強くする。ただし各取引所のCSV仕様は
 * 公開ドキュメント・第三者記事を元にした推定であり、取引所側の仕様変更や
 * 記事との差異により実際のファイルが取り込めない場合がある。その場合は
 * エラーメッセージに不足カラムが表示されるので、このファイルの
 * HEADER_ALIASES / 必須カラムを実物のCSVに合わせて調整すること。
 *
 * 対応範囲(初期版): 現物取引の買い/売り(円建てのみ)。
 * 暗号資産同士の交換・入出金・レバレッジ取引の行はスキップし、
 * 必要であれば「暗号資産の取引を追加」フォームから手入力する。
 */

export type CryptoExchange = "coincheck" | "bitflyer" | "gmo_coin";

export const SUPPORTED_CRYPTO_EXCHANGES: CryptoExchange[] = [
  "coincheck",
  "bitflyer",
  "gmo_coin",
];

export const EXCHANGE_LABELS: Record<CryptoExchange, string> = {
  coincheck: "Coincheck(業界標準フォーマット)",
  bitflyer: "bitFlyer(現物取引履歴CSV)",
  gmo_coin: "GMOコイン(取引履歴CSV)",
};

export interface ExchangeCryptoTradeRow {
  tradedAt: Date;
  symbol: string;
  type: Extract<CryptoTradeType, "BUY" | "SELL">;
  quantity: Decimal;
  unitPriceJpy: Decimal;
  feeJpy: Decimal;
  memo: string | null;
}

export interface ExchangeCsvParseSkip {
  lineNumber: number;
  reason: string;
}

export interface ExchangeCsvParseResult {
  rows: ExchangeCryptoTradeRow[];
  skippedRows: ExchangeCsvParseSkip[];
}

function parseFlexibleDate(value: string): Date | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  // "YYYY/MM/DD HH:mm:ss" や "YYYY-MM-DD HH:mm" 等をローカル時刻として解釈する。
  const normalized = trimmed.replace(/\//g, "-").replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDecimalLoose(value: string): Decimal | null {
  const normalized = value.replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  try {
    return new Decimal(normalized);
  } catch {
    return null;
  }
}

function buildFieldIndex(
  headerRow: string[],
  aliases: Record<string, string>,
): Map<string, number> {
  const fieldIndex = new Map<string, number>();
  headerRow.forEach((header, index) => {
    const key = aliases[header.trim()];
    if (key) fieldIndex.set(key, index);
  });
  return fieldIndex;
}

export function parseExchangeCryptoCsv(
  exchange: CryptoExchange,
  csvText: string,
): ExchangeCsvParseResult {
  switch (exchange) {
    case "coincheck":
      return parseCoincheckCsv(csvText);
    case "bitflyer":
      return parseBitflyerCsv(csvText);
    case "gmo_coin":
      return parseGmoCoinCsv(csvText);
  }
}

/**
 * Coincheck「業界標準フォーマット」CSV。
 * ヘッダー: id,time,operation,amount,trading_currency,price,original_currency,fee,comment
 * amount = trading_currency の数量、price = original_currency建ての取引総額
 * (単価ではなく総額)。1単位あたりの単価は price / amount で算出する。
 */
function parseCoincheckCsv(csvText: string): ExchangeCsvParseResult {
  const csvRows = parseCsvRows(csvText);
  if (csvRows.length === 0) return { rows: [], skippedRows: [] };

  const headerRow = csvRows[0].map((h) => h.trim().toLowerCase());
  const fieldIndex = new Map<string, number>();
  headerRow.forEach((h, i) => fieldIndex.set(h, i));

  const required = ["time", "operation", "amount", "trading_currency", "price"];
  const missing = required.filter((f) => !fieldIndex.has(f));
  if (missing.length > 0) {
    throw new Error(
      `Coincheckの業界標準フォーマットCSVとして認識できませんでした。不足しているカラム: ${missing.join(", ")}`,
    );
  }

  const get = (cols: string[], key: string): string | undefined => {
    const index = fieldIndex.get(key);
    return index === undefined ? undefined : cols[index];
  };

  const rows: ExchangeCryptoTradeRow[] = [];
  const skippedRows: ExchangeCsvParseSkip[] = [];

  for (let i = 1; i < csvRows.length; i++) {
    const cols = csvRows[i];
    const lineNumber = i + 1;

    const rawTime = get(cols, "time");
    const rawOperation = get(cols, "operation")?.trim().toLowerCase();
    const rawAmount = get(cols, "amount");
    const rawCurrency = get(cols, "trading_currency")?.trim().toUpperCase();
    const rawPrice = get(cols, "price");
    const rawOriginalCurrency =
      get(cols, "original_currency")?.trim().toUpperCase() || "JPY";
    const rawFee = get(cols, "fee");

    if (!rawTime || !rawOperation || !rawAmount || !rawCurrency || !rawPrice) {
      skippedRows.push({ lineNumber, reason: "必須項目が空です" });
      continue;
    }

    if (rawOperation !== "buy" && rawOperation !== "sell") {
      skippedRows.push({
        lineNumber,
        reason: `未対応のoperationのためスキップしました: "${rawOperation}"(入出金・送付等は現在未対応です)`,
      });
      continue;
    }

    if (rawOriginalCurrency !== "JPY") {
      skippedRows.push({
        lineNumber,
        reason: `円建てでない取引(${rawCurrency}/${rawOriginalCurrency})は現在未対応です。手入力で登録してください`,
      });
      continue;
    }

    const tradedAt = parseFlexibleDate(rawTime);
    if (!tradedAt) {
      skippedRows.push({ lineNumber, reason: `日時を解釈できません: "${rawTime}"` });
      continue;
    }

    const amount = parseDecimalLoose(rawAmount);
    const price = parseDecimalLoose(rawPrice);
    const fee = rawFee ? parseDecimalLoose(rawFee) : new Decimal(0);
    if (!amount || amount.isZero() || !price || !fee) {
      skippedRows.push({ lineNumber, reason: "数量・金額を解釈できません" });
      continue;
    }

    rows.push({
      tradedAt,
      symbol: rawCurrency,
      type: rawOperation === "buy" ? "BUY" : "SELL",
      quantity: amount.abs(),
      unitPriceJpy: price.abs().dividedBy(amount.abs()),
      feeJpy: fee.abs(),
      memo: get(cols, "comment")?.trim() || null,
    });
  }

  return { rows, skippedRows };
}

const BITFLYER_HEADER_ALIASES: Record<string, string> = {
  取引日時: "date",
  "Trade Date": "date",
  通貨: "pair",
  Product: "pair",
  取引種別: "side",
  "Trade Type": "side",
  取引価格: "unitPrice",
  "Traded Price": "unitPrice",
  通貨1: "currency1",
  "Currency 1": "currency1",
  通貨1数量: "quantity1",
  "Amount(Currency 1)": "quantity1",
  "Amount (Currency 1)": "quantity1",
  手数料: "fee",
  Fee: "fee",
  通貨1の対円レート: "jpyRate",
  "JPY Rate": "jpyRate",
  通貨2: "currency2",
  "Currency 2": "currency2",
  通貨2数量: "quantity2",
  "Amount(Currency 2)": "quantity2",
  "Amount (Currency 2)": "quantity2",
  備考: "memo",
  Details: "memo",
};

const BITFLYER_BUY_LABELS = new Set(["buy", "買い", "現物買い", "買"]);
const BITFLYER_SELL_LABELS = new Set(["sell", "売り", "現物売り", "売"]);

/**
 * bitFlyer 現物取引履歴CSV(TradeHistory_*.csv)。
 * 手数料は円建てとして扱う(暗号資産建て手数料だった場合は取り込み後に
 * 手動で調整すること)。通貨2がJPYでない場合は「通貨1の対円レート」を
 * 単価として使う。
 */
function parseBitflyerCsv(csvText: string): ExchangeCsvParseResult {
  const csvRows = parseCsvRows(csvText);
  if (csvRows.length === 0) return { rows: [], skippedRows: [] };

  const fieldIndex = buildFieldIndex(csvRows[0], BITFLYER_HEADER_ALIASES);
  const required = ["date", "side", "unitPrice", "currency1", "quantity1"];
  const missing = required.filter((f) => !fieldIndex.has(f));
  if (missing.length > 0) {
    throw new Error(
      `bitFlyerの取引履歴CSVとして認識できませんでした。不足しているカラム: ${missing.join(", ")}`,
    );
  }

  const get = (cols: string[], key: string): string | undefined => {
    const index = fieldIndex.get(key);
    return index === undefined ? undefined : cols[index];
  };

  const rows: ExchangeCryptoTradeRow[] = [];
  const skippedRows: ExchangeCsvParseSkip[] = [];

  for (let i = 1; i < csvRows.length; i++) {
    const cols = csvRows[i];
    const lineNumber = i + 1;

    const rawDate = get(cols, "date");
    const rawSide = get(cols, "side")?.trim();
    const rawUnitPrice = get(cols, "unitPrice");
    const rawCurrency1 = get(cols, "currency1")?.trim().toUpperCase();
    const rawQuantity1 = get(cols, "quantity1");

    if (!rawDate || !rawSide || !rawUnitPrice || !rawCurrency1 || !rawQuantity1) {
      skippedRows.push({ lineNumber, reason: "必須項目が空です" });
      continue;
    }

    const sideLower = rawSide.toLowerCase();
    let type: "BUY" | "SELL" | null = null;
    if (BITFLYER_BUY_LABELS.has(sideLower) || BITFLYER_BUY_LABELS.has(rawSide)) {
      type = "BUY";
    } else if (
      BITFLYER_SELL_LABELS.has(sideLower) ||
      BITFLYER_SELL_LABELS.has(rawSide)
    ) {
      type = "SELL";
    }
    if (!type) {
      skippedRows.push({
        lineNumber,
        reason: `未対応の取引種別のためスキップしました: "${rawSide}"(入出金・送付等は現在未対応です)`,
      });
      continue;
    }

    const tradedAt = parseFlexibleDate(rawDate);
    if (!tradedAt) {
      skippedRows.push({ lineNumber, reason: `日時を解釈できません: "${rawDate}"` });
      continue;
    }

    const currency2 = get(cols, "currency2")?.trim().toUpperCase() || "JPY";
    let unitPriceJpy: Decimal | null;
    if (currency2 === "JPY") {
      unitPriceJpy = parseDecimalLoose(rawUnitPrice);
    } else {
      const rawJpyRate = get(cols, "jpyRate");
      unitPriceJpy = rawJpyRate ? parseDecimalLoose(rawJpyRate) : null;
      if (!unitPriceJpy) {
        skippedRows.push({
          lineNumber,
          reason: `円建てでない通貨ペア(${rawCurrency1}/${currency2})は現在未対応です。手入力で登録してください`,
        });
        continue;
      }
    }

    const quantity1 = parseDecimalLoose(rawQuantity1);
    if (!unitPriceJpy || !quantity1 || quantity1.isZero()) {
      skippedRows.push({ lineNumber, reason: "数量・単価を解釈できません" });
      continue;
    }

    const rawFee = get(cols, "fee");
    const fee = rawFee ? parseDecimalLoose(rawFee) : new Decimal(0);

    rows.push({
      tradedAt,
      symbol: rawCurrency1,
      type,
      quantity: quantity1.abs(),
      unitPriceJpy: unitPriceJpy.abs(),
      feeJpy: fee ? fee.abs() : new Decimal(0),
      memo: get(cols, "memo")?.trim() || null,
    });
  }

  return { rows, skippedRows };
}

const GMO_COIN_HEADER_ALIASES: Record<string, string> = {
  日時: "date",
  取引区分: "tradeCategory",
  売買区分: "side",
  銘柄名: "symbol",
  約定数量: "quantity",
  約定レート: "unitPrice",
  注文手数料: "fee",
};

/**
 * GMOコイン取引履歴CSV。現物・レバレッジ取引・入出金が1ファイルに
 * 混在しているため、「取引区分」に"現物"を含む行のみを対象にする。
 * 手数料がマイナス(メイカー報酬等)の場合は0として扱う。
 */
function parseGmoCoinCsv(csvText: string): ExchangeCsvParseResult {
  const csvRows = parseCsvRows(csvText);
  if (csvRows.length === 0) return { rows: [], skippedRows: [] };

  const fieldIndex = buildFieldIndex(csvRows[0], GMO_COIN_HEADER_ALIASES);
  const required = ["date", "tradeCategory", "side", "symbol", "quantity", "unitPrice"];
  const missing = required.filter((f) => !fieldIndex.has(f));
  if (missing.length > 0) {
    throw new Error(
      `GMOコインの取引履歴CSVとして認識できませんでした。不足しているカラム: ${missing.join(", ")}`,
    );
  }

  const get = (cols: string[], key: string): string | undefined => {
    const index = fieldIndex.get(key);
    return index === undefined ? undefined : cols[index];
  };

  const rows: ExchangeCryptoTradeRow[] = [];
  const skippedRows: ExchangeCsvParseSkip[] = [];

  for (let i = 1; i < csvRows.length; i++) {
    const cols = csvRows[i];
    const lineNumber = i + 1;

    const rawCategory = get(cols, "tradeCategory")?.trim() ?? "";
    if (!rawCategory.includes("現物")) {
      skippedRows.push({
        lineNumber,
        reason: `現物取引以外(レバレッジ取引・入出金等)のためスキップしました: "${rawCategory || "(空欄)"}"`,
      });
      continue;
    }

    const rawDate = get(cols, "date");
    const rawSide = get(cols, "side")?.trim();
    const rawSymbol = get(cols, "symbol")?.trim().toUpperCase();
    const rawQuantity = get(cols, "quantity");
    const rawUnitPrice = get(cols, "unitPrice");

    if (!rawDate || !rawSide || !rawSymbol || !rawQuantity || !rawUnitPrice) {
      skippedRows.push({ lineNumber, reason: "必須項目が空です" });
      continue;
    }

    const sideLower = rawSide.toLowerCase();
    let type: "BUY" | "SELL" | null = null;
    if (sideLower === "buy" || rawSide === "買") type = "BUY";
    else if (sideLower === "sell" || rawSide === "売") type = "SELL";
    if (!type) {
      skippedRows.push({
        lineNumber,
        reason: `未対応の売買区分のためスキップしました: "${rawSide}"`,
      });
      continue;
    }

    const tradedAt = parseFlexibleDate(rawDate);
    if (!tradedAt) {
      skippedRows.push({ lineNumber, reason: `日時を解釈できません: "${rawDate}"` });
      continue;
    }

    const quantity = parseDecimalLoose(rawQuantity);
    const unitPrice = parseDecimalLoose(rawUnitPrice);
    if (!quantity || quantity.isZero() || !unitPrice) {
      skippedRows.push({ lineNumber, reason: "数量・単価を解釈できません" });
      continue;
    }

    const rawFee = get(cols, "fee");
    const fee = rawFee ? parseDecimalLoose(rawFee) : new Decimal(0);
    const feeJpy = fee && fee.isPositive() ? fee : new Decimal(0);

    // 銘柄名が "BTC_JPY" 等ペア表記の場合は暗号資産側のシンボルのみを残す。
    const symbol = rawSymbol.replace(/[-_/]?JPY$/i, "") || rawSymbol;

    rows.push({
      tradedAt,
      symbol,
      type,
      quantity: quantity.abs(),
      unitPriceJpy: unitPrice.abs(),
      feeJpy,
      memo: null,
    });
  }

  return { rows, skippedRows };
}
