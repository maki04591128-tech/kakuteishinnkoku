import { Decimal } from "decimal.js";
import { parseCsvRows } from "@/lib/csv";
import type { ExchangeCsvParseResult, ExchangeTradeRow } from "./types";
import { parseDecimalField, parseExchangeDateTime } from "./util";

/**
 * Coincheckの「業界標準フォーマット」取引履歴CSV
 * (取引履歴画面の「業界標準フォーマットはこちら」からダウンロードできるzip内のCSV)のパーサー。
 *
 * ヘッダー: id,time,operation,amount,trading_currency,price,original_currency,fee,comment
 *
 * **既知の制約(重要):**
 * - Coincheckは日本円建てのみの取引所のため、original_currency は
 *   常に JPY である前提で扱う。異なる場合はスキップする。
 * - operation が "buy" / "sell" の行のみ取り込む。入出金
 *   (deposit/withdraw)等、売買以外の行はCryptoTradeの対象外のため
 *   スキップする。
 * - fee は JPY 建てとして扱う。
 */
export function parseCoincheckStandardCsv(csvText: string): ExchangeCsvParseResult {
  const csvRows = parseCsvRows(csvText);
  if (csvRows.length === 0) {
    return { rows: [], skippedRows: [] };
  }

  const headerRow = csvRows[0];
  const fieldIndex = new Map<string, number>();
  headerRow.forEach((header, index) => fieldIndex.set(header.trim().toLowerCase(), index));

  const required = ["time", "operation", "amount", "trading_currency", "price", "original_currency"];
  const missing = required.filter((f) => !fieldIndex.has(f));
  if (missing.length > 0) {
    throw new Error(
      `Coincheckの業界標準フォーマットCSVとして認識できませんでした。不足しているカラム: ${missing.join(", ")}`,
    );
  }

  const get = (cols: string[], key: string): string | undefined => {
    const index = fieldIndex.get(key);
    if (index === undefined) return undefined;
    return cols[index];
  };

  const rows: ExchangeTradeRow[] = [];
  const skippedRows: ExchangeCsvParseResult["skippedRows"] = [];

  for (let i = 1; i < csvRows.length; i++) {
    const cols = csvRows[i];
    const lineNumber = i + 1;

    const originalCurrency = get(cols, "original_currency")?.trim().toUpperCase();
    if (originalCurrency !== "JPY") {
      skippedRows.push({
        lineNumber,
        reason: `JPY建て以外(original_currency=${originalCurrency ?? "不明"})は未対応です`,
      });
      continue;
    }

    const operation = get(cols, "operation")?.trim().toLowerCase();
    if (operation !== "buy" && operation !== "sell") {
      skippedRows.push({
        lineNumber,
        reason: `未対応のoperationです(buy/sell以外はスキップ): "${operation ?? ""}"`,
      });
      continue;
    }

    const rawTime = get(cols, "time");
    const tradedAt = rawTime ? parseExchangeDateTime(rawTime) : null;
    if (!tradedAt) {
      skippedRows.push({ lineNumber, reason: `timeを解釈できません: "${rawTime}"` });
      continue;
    }

    const symbol = get(cols, "trading_currency")?.trim().toUpperCase();
    if (!symbol) {
      skippedRows.push({ lineNumber, reason: "trading_currency(銘柄)が空です" });
      continue;
    }

    const quantity = parseDecimalField(get(cols, "amount"));
    if (!quantity || quantity.isZero()) {
      skippedRows.push({
        lineNumber,
        reason: `amountを解釈できません: "${get(cols, "amount")}"`,
      });
      continue;
    }

    const unitPriceJpy = parseDecimalField(get(cols, "price"));
    if (!unitPriceJpy) {
      skippedRows.push({ lineNumber, reason: `priceを解釈できません: "${get(cols, "price")}"` });
      continue;
    }

    const feeRaw = get(cols, "fee");
    const feeJpy = feeRaw ? (parseDecimalField(feeRaw) ?? new Decimal(0)) : new Decimal(0);

    rows.push({
      tradedAt,
      symbol,
      type: operation === "buy" ? "BUY" : "SELL",
      quantity: quantity.abs(),
      unitPriceJpy: unitPriceJpy.abs(),
      feeJpy: feeJpy.abs(),
      memo: get(cols, "comment")?.trim() || null,
    });
  }

  return { rows, skippedRows };
}
