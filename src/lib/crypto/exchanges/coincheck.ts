import { Decimal } from "decimal.js";
import { parseCsvRows } from "@/lib/csv";
<<<<<<< HEAD
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
=======
import { parseExchangeDateTime, parseExchangeDecimal } from "./parseUtil";
import { FIAT_SYMBOL, type ExchangeParseResult, type ExchangeParseSkip } from "./types";

/**
 * Coincheckの「業界標準フォーマット」取引履歴CSV(2025年1月以降の形式)のパーサー。
 *
 * ヘッダー: 取引日時,取引種別,取引形態,通貨ペア,増加通貨名,増加数量,
 *           減少通貨名,減少数量,約定価格/数量,単価,手数料通貨,手数料数量,
 *           送付元アドレス,送付先アドレス,登録番号,社名,備考
 *
 * 増加通貨名/減少通貨名の両方が入っている行が売買(交換)を表す。
 * 入金・出金・送付など片側しか無い行は対象外としてスキップする。
 * 増加側・減少側のどちらかがJPYであれば円建ての売買として取り込み、
 * どちらもJPYでない(暗号資産同士の交換)行は自動取込未対応としてスキップする。
 */

const HEADER_ALIASES: Record<string, string> = {
  取引日時: "tradedAt",
  増加通貨名: "gainedCurrency",
  増加数量: "gainedQuantity",
  減少通貨名: "lostCurrency",
  減少数量: "lostQuantity",
  単価: "unitPrice",
  手数料通貨: "feeCurrency",
  手数料数量: "feeQuantity",
  備考: "memo",
};

const REQUIRED_FIELDS = [
  "tradedAt",
  "gainedCurrency",
  "gainedQuantity",
  "lostCurrency",
  "lostQuantity",
] as const;

export function parseCoincheckCsv(csvText: string): ExchangeParseResult {
>>>>>>> origin/claude/wonderful-edison-xzm3zs
  const csvRows = parseCsvRows(csvText);
  if (csvRows.length === 0) {
    return { rows: [], skippedRows: [] };
  }

  const headerRow = csvRows[0];
  const fieldIndex = new Map<string, number>();
<<<<<<< HEAD
  headerRow.forEach((header, index) => fieldIndex.set(header.trim().toLowerCase(), index));

  const required = ["time", "operation", "amount", "trading_currency", "price", "original_currency"];
  const missing = required.filter((f) => !fieldIndex.has(f));
  if (missing.length > 0) {
    throw new Error(
      `Coincheckの業界標準フォーマットCSVとして認識できませんでした。不足しているカラム: ${missing.join(", ")}`,
=======
  headerRow.forEach((header, index) => {
    const key = HEADER_ALIASES[header.trim()];
    if (key) fieldIndex.set(key, index);
  });

  const missingRequired = REQUIRED_FIELDS.filter((f) => !fieldIndex.has(f));
  if (missingRequired.length > 0) {
    throw new Error(
      "Coincheckの取引履歴CSV形式として認識できませんでした。「業界標準フォーマット」でダウンロードしたCSVをそのままアップロードしてください。",
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
=======
    const tradedAt = parseExchangeDateTime(get(cols, "tradedAt") ?? "");
    const gainedCurrency = (get(cols, "gainedCurrency") ?? "").trim().toUpperCase();
    const lostCurrency = (get(cols, "lostCurrency") ?? "").trim().toUpperCase();
    const gainedQuantity = parseExchangeDecimal(get(cols, "gainedQuantity"));
    const lostQuantity = parseExchangeDecimal(get(cols, "lostQuantity"));

    if (!tradedAt) {
      skippedRows.push({ lineNumber, reason: `取引日時を解釈できません: "${get(cols, "tradedAt")}"` });
      continue;
    }
    if (!gainedCurrency || !lostCurrency) {
      // 入金・出金・送付など、増減の片側しか無い行(売買ではない)
      skippedRows.push({ lineNumber, reason: "売買以外の行(入出金・送付等)のためスキップしました" });
      continue;
    }
    if (
      gainedQuantity === null ||
      gainedQuantity.isZero() ||
      lostQuantity === null ||
      lostQuantity.isZero()
    ) {
      skippedRows.push({ lineNumber, reason: "数量を解釈できません" });
      continue;
    }
    if (gainedCurrency !== FIAT_SYMBOL && lostCurrency !== FIAT_SYMBOL) {
      skippedRows.push({
        lineNumber,
        reason: `暗号資産同士の交換(${lostCurrency}/${gainedCurrency})は自動取込未対応です。手動で追加してください`,
>>>>>>> origin/claude/wonderful-edison-xzm3zs
      });
      continue;
    }

<<<<<<< HEAD
    const unitPriceJpy = parseDecimalField(get(cols, "price"));
    if (!unitPriceJpy) {
      skippedRows.push({ lineNumber, reason: `priceを解釈できません: "${get(cols, "price")}"` });
      continue;
    }

    const feeRaw = get(cols, "fee");
    const feeJpy = feeRaw ? (parseDecimalField(feeRaw) ?? new Decimal(0)) : new Decimal(0);
=======
    const isBuy = lostCurrency === FIAT_SYMBOL;
    const symbol = isBuy ? gainedCurrency : lostCurrency;
    const cryptoQuantity = isBuy ? gainedQuantity : lostQuantity;
    const jpyAmount = isBuy ? lostQuantity : gainedQuantity;
    const unitPrice =
      parseExchangeDecimal(get(cols, "unitPrice")) ?? jpyAmount.dividedBy(cryptoQuantity);

    const feeCurrency = (get(cols, "feeCurrency") ?? "").trim().toUpperCase();
    const feeQuantity = parseExchangeDecimal(get(cols, "feeQuantity")) ?? new Decimal(0);
    const feeJpy =
      feeCurrency === FIAT_SYMBOL || feeCurrency === ""
        ? feeQuantity.abs()
        : feeQuantity.abs().times(unitPrice);
>>>>>>> origin/claude/wonderful-edison-xzm3zs

    rows.push({
      tradedAt,
      symbol,
<<<<<<< HEAD
      type: operation === "buy" ? "BUY" : "SELL",
      quantity: quantity.abs(),
      unitPriceJpy: unitPriceJpy.abs(),
      feeJpy: feeJpy.abs(),
      memo: get(cols, "comment")?.trim() || null,
=======
      type: isBuy ? "BUY" : "SELL",
      quantity: cryptoQuantity.abs(),
      unitPriceJpy: unitPrice.abs(),
      feeJpy,
      memo: get(cols, "memo")?.trim() || null,
>>>>>>> origin/claude/wonderful-edison-xzm3zs
    });
  }

  return { rows, skippedRows };
}
