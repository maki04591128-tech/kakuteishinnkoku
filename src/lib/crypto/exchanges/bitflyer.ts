import { Decimal } from "decimal.js";
import { parseCsvRows } from "@/lib/csv";
<<<<<<< HEAD
import type { ExchangeCsvParseResult, ExchangeTradeRow } from "./types";
import { parseDecimalField, parseExchangeDateTime } from "./util";

/**
 * bitFlyer「お取引レポート」でダウンロードできる現物取引CSV
 * (ファイル名例: TradeHistory_YYYYMMDD.csv) のパーサー。
=======
import { parseExchangeDateTime, parseExchangeDecimal } from "./parseUtil";
import { FIAT_SYMBOL, type ExchangeParseResult, type ExchangeParseSkip } from "./types";

/**
 * bitFlyer「お取引レポート」からダウンロードできる現物取引履歴CSV
 * (ファイル名例: TradeHistory_YYYYMMDD.csv)のパーサー。
>>>>>>> origin/claude/wonderful-edison-xzm3zs
 *
 * ヘッダー: 取引日時,通貨,取引種別,取引価格,通貨1,通貨1数量,手数料,
 *           通貨1の対円レート,通貨2,通貨2数量,自己・媒介,注文ID,備考
 *
<<<<<<< HEAD
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
=======
 * 手数料は通貨1(取引対象の暗号資産)建てで請求されるため、
 * 「通貨1の対円レート」を掛けて円換算する。
 * 通貨2がJPYでない行(暗号資産同士の交換)は本ツールのデータモデルでは
 * 2行に分解する必要があり誤変換のリスクが高いため、現時点ではスキップし
 * 手動での追加を促す。
 */

const HEADER_ALIASES: Record<string, string> = {
  取引日時: "tradedAt",
  取引種別: "type",
  取引価格: "unitPrice",
  通貨1: "currency1",
  通貨1数量: "quantity1",
  手数料: "fee",
  通貨1の対円レート: "rate1Jpy",
  通貨2: "currency2",
  備考: "memo",
};

const REQUIRED_FIELDS = [
  "tradedAt",
  "type",
  "unitPrice",
  "currency1",
  "quantity1",
  "currency2",
] as const;

export function parseBitflyerCsv(csvText: string): ExchangeParseResult {
>>>>>>> origin/claude/wonderful-edison-xzm3zs
  const csvRows = parseCsvRows(csvText);
  if (csvRows.length === 0) {
    return { rows: [], skippedRows: [] };
  }

  const headerRow = csvRows[0];
  const fieldIndex = new Map<string, number>();
<<<<<<< HEAD
  headerRow.forEach((header, index) => fieldIndex.set(header.trim(), index));

  const required = ["取引日時", "取引種別", "取引価格", "通貨1", "通貨1数量", "通貨2"];
  const missing = required.filter((f) => !fieldIndex.has(f));
  if (missing.length > 0) {
    throw new Error(
      `bitFlyerの取引履歴CSVとして認識できませんでした。不足しているカラム: ${missing.join(", ")}`,
=======
  headerRow.forEach((header, index) => {
    const key = HEADER_ALIASES[header.trim()];
    if (key) fieldIndex.set(key, index);
  });

  const missingRequired = REQUIRED_FIELDS.filter((f) => !fieldIndex.has(f));
  if (missingRequired.length > 0) {
    throw new Error(
      "bitFlyerの取引履歴CSV形式として認識できませんでした。「お取引レポート」の現物取引CSVをそのままアップロードしてください。",
>>>>>>> origin/claude/wonderful-edison-xzm3zs
    );
  }

  const get = (cols: string[], key: string): string | undefined => {
    const index = fieldIndex.get(key);
    if (index === undefined) return undefined;
    return cols[index];
  };

<<<<<<< HEAD
  const rows: ExchangeTradeRow[] = [];
  const skippedRows: ExchangeCsvParseResult["skippedRows"] = [];
=======
  const rows: ExchangeParseResult["rows"] = [];
  const skippedRows: ExchangeParseSkip[] = [];
>>>>>>> origin/claude/wonderful-edison-xzm3zs

  for (let i = 1; i < csvRows.length; i++) {
    const cols = csvRows[i];
    const lineNumber = i + 1;

<<<<<<< HEAD
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
=======
    const tradedAt = parseExchangeDateTime(get(cols, "tradedAt") ?? "");
    const typeRaw = (get(cols, "type") ?? "").trim().toUpperCase();
    const currency1 = (get(cols, "currency1") ?? "").trim().toUpperCase();
    const currency2 = (get(cols, "currency2") ?? "").trim().toUpperCase();
    const unitPrice = parseExchangeDecimal(get(cols, "unitPrice"));
    const quantity1 = parseExchangeDecimal(get(cols, "quantity1"));

    if (!tradedAt) {
      skippedRows.push({ lineNumber, reason: `取引日時を解釈できません: "${get(cols, "tradedAt")}"` });
      continue;
    }
    if (typeRaw !== "BUY" && typeRaw !== "SELL") {
      skippedRows.push({ lineNumber, reason: `未対応の取引種別です: "${typeRaw}"` });
      continue;
    }
    if (!currency1 || quantity1 === null || quantity1.isZero()) {
      skippedRows.push({ lineNumber, reason: "数量を解釈できません" });
      continue;
    }
    if (unitPrice === null) {
      skippedRows.push({ lineNumber, reason: "取引価格を解釈できません" });
      continue;
    }
    if (currency2 !== FIAT_SYMBOL) {
      skippedRows.push({
        lineNumber,
        reason: `暗号資産同士の交換(${currency1}/${currency2})は自動取込未対応です。手動で追加してください`,
>>>>>>> origin/claude/wonderful-edison-xzm3zs
      });
      continue;
    }

<<<<<<< HEAD
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
=======
    const feeRaw = parseExchangeDecimal(get(cols, "fee")) ?? new Decimal(0);
    const rate1Jpy = parseExchangeDecimal(get(cols, "rate1Jpy")) ?? unitPrice;
    const feeJpy = feeRaw.abs().times(rate1Jpy);

    rows.push({
      tradedAt,
      symbol: currency1,
      type: typeRaw === "BUY" ? "BUY" : "SELL",
      quantity: quantity1.abs(),
      unitPriceJpy: unitPrice.abs(),
      feeJpy,
      memo: get(cols, "memo")?.trim() || null,
>>>>>>> origin/claude/wonderful-edison-xzm3zs
    });
  }

  return { rows, skippedRows };
}
