import { Decimal } from "decimal.js";
import { parseCsvRows } from "@/lib/csv";
import type { ExchangeCsvParseResult, ExchangeTradeRow } from "./types";
import { parseDecimalField, parseExchangeDateTime } from "./util";

/**
 * bitFlyer「お取引レポート」でダウンロードできる現物取引CSV
 * (ファイル名例: TradeHistory_YYYYMMDD.csv) のパーサー。
 *
 * ヘッダー: 取引日時,通貨,取引種別,取引価格,通貨1,通貨1数量,手数料,
 *           通貨1の対円レート,通貨2,通貨2数量,自己・媒介,注文ID,備考
 *
 * **既知の制約(重要):**
 * - 対応するのは「通貨2」が JPY の現物取引(BTC_JPY, ETH_JPY 等)のみ。
 *   アルトコイン間のペア(例: ETH_BTC)は本ツールの CryptoTrade
 *   モデルでは TRADE_IN/TRADE_OUT として2銘柄分の記録が必要になるため、
 *   誤変換を避けるためスキップする(将来対応予定)。
 * - 「取引種別」列は取得できたサンプルで正確な値を確認できなかったため、
 *   「買」「売」という文字列を含むかどうかで購入/売却を判定する。
 *   入出金・レンディング等、購入・売却以外の行はスキップする。
 * - 手数料は JPY 建てとして扱う。暗号資産建てで手数料が引かれている
 *   場合は正しく変換できないため、取り込み後に元のCSVと突き合わせて
 *   確認すること。
 */
export function parseBitflyerTradeHistoryCsv(csvText: string): ExchangeCsvParseResult {
  const csvRows = parseCsvRows(csvText);
  if (csvRows.length === 0) {
    return { rows: [], skippedRows: [] };
  }

  const headerRow = csvRows[0];
  const fieldIndex = new Map<string, number>();
  headerRow.forEach((header, index) => fieldIndex.set(header.trim(), index));

  const required = ["取引日時", "取引種別", "取引価格", "通貨1", "通貨1数量", "通貨2"];
  const missing = required.filter((f) => !fieldIndex.has(f));
  if (missing.length > 0) {
    throw new Error(
      `bitFlyerの取引履歴CSVとして認識できませんでした。不足しているカラム: ${missing.join(", ")}`,
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

    const currency2 = get(cols, "通貨2")?.trim();
    if (currency2 !== "JPY") {
      skippedRows.push({
        lineNumber,
        reason: `JPY建て以外のペア(通貨2=${currency2 ?? "不明"})は未対応です`,
      });
      continue;
    }

    const rawType = get(cols, "取引種別")?.trim() ?? "";
    const isBuy = rawType.includes("買");
    const isSell = rawType.includes("売");
    if (!isBuy && !isSell) {
      skippedRows.push({
        lineNumber,
        reason: `未対応の取引種別です(購入・売却以外はスキップ): "${rawType}"`,
      });
      continue;
    }

    const rawDate = get(cols, "取引日時");
    const tradedAt = rawDate ? parseExchangeDateTime(rawDate) : null;
    if (!tradedAt) {
      skippedRows.push({ lineNumber, reason: `取引日時を解釈できません: "${rawDate}"` });
      continue;
    }

    const symbol = get(cols, "通貨1")?.trim().toUpperCase();
    if (!symbol) {
      skippedRows.push({ lineNumber, reason: "通貨1(銘柄)が空です" });
      continue;
    }

    const quantity = parseDecimalField(get(cols, "通貨1数量"));
    if (!quantity || quantity.isZero()) {
      skippedRows.push({
        lineNumber,
        reason: `通貨1数量を解釈できません: "${get(cols, "通貨1数量")}"`,
      });
      continue;
    }

    const unitPriceJpy = parseDecimalField(get(cols, "取引価格"));
    if (!unitPriceJpy) {
      skippedRows.push({
        lineNumber,
        reason: `取引価格を解釈できません: "${get(cols, "取引価格")}"`,
      });
      continue;
    }

    const feeRaw = get(cols, "手数料");
    const feeJpy = feeRaw ? (parseDecimalField(feeRaw) ?? new Decimal(0)) : new Decimal(0);

    rows.push({
      tradedAt,
      symbol,
      type: isBuy ? "BUY" : "SELL",
      quantity: quantity.abs(),
      unitPriceJpy: unitPriceJpy.abs(),
      feeJpy: feeJpy.abs(),
      memo: get(cols, "注文ID")?.trim() || null,
    });
  }

  return { rows, skippedRows };
}
