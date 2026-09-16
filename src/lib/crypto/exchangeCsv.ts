import { Decimal } from "decimal.js";
import { parseCsvRows, normalizeNumericString, parseFlexibleDateTime } from "../csv";
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
 * 対応取引所(2026年時点で確認できた仕様に基づく。現物取引のみ):
 *  - bitflyer: bitFlyer「お取引レポート」現物取引履歴CSV
 *  - coincheck: Coincheckの「業界標準フォーマット」CSV(JCBA参考フォーマット準拠)
 *  - gmo: GMOコイン取引履歴CSV(現物取引の行のみ。証拠金取引・入出金行は対象外)
 */

export type ExchangeCsvPreset = "bitflyer" | "coincheck" | "gmo";

export const EXCHANGE_CSV_PRESETS: { value: ExchangeCsvPreset; label: string }[] = [
  { value: "bitflyer", label: "bitFlyer(現物取引履歴CSV)" },
  { value: "coincheck", label: "Coincheck(業界標準フォーマットCSV)" },
  { value: "gmo", label: "GMOコイン(取引履歴CSV・現物のみ)" },
];

const EXCHANGE_LABELS: Record<ExchangeCsvPreset, string> = {
  bitflyer: "bitFlyer",
  coincheck: "Coincheck",
  gmo: "GMOコイン",
};

export interface ExchangeCsvRow {
  tradedAt: Date;
  symbol: string;
  type: CryptoTradeType;
  quantity: Decimal;
  unitPriceJpy: Decimal;
  feeJpy: Decimal;
  exchange: string;
  memo: string | null;
}

export interface ExchangeCsvSkip {
  lineNumber: number;
  reason: string;
}

export interface ExchangeCsvParseResult {
  rows: ExchangeCsvRow[];
  skippedRows: ExchangeCsvSkip[];
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

export function parseExchangeCsv(
  preset: ExchangeCsvPreset,
  csvText: string,
): ExchangeCsvParseResult {
  switch (preset) {
    case "bitflyer":
      return parseBitflyerCsv(csvText);
    case "coincheck":
      return parseCoincheckCsv(csvText);
    case "gmo":
      return parseGmoCoinCsv(csvText);
  }
}

// ---------------------------------------------------------------------------
// bitFlyer
// ---------------------------------------------------------------------------
// ヘッダー: 取引日時,通貨,取引種別,取引価格,通貨1,通貨1数量,手数料,
//           通貨1の対円レート,通貨2,通貨2数量,自己・媒介,注文ID,備考
// 取引種別が「買い」「売り」の行のみ現物売買として取り込む。
// 手数料は通貨1(暗号資産)建てで請求されるため、対円レートで円換算する。

const BITFLYER_REQUIRED = ["取引日時", "取引種別", "通貨1", "通貨1数量", "取引価格"];

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
    const dateValue = parseFlexibleDateTime(get("取引日時"));

    if (!symbol || !quantityStr || !priceStr || !dateValue) {
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
      tradedAt: dateValue,
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

// ---------------------------------------------------------------------------
// Coincheck (業界標準フォーマット / JCBA参考フォーマット準拠)
// ---------------------------------------------------------------------------
// ヘッダー: 取引日時,取引種別,取引形態,通貨ペア,増加通貨名,増加数量,
//           減少通貨名,減少数量,約定代金,約定価格,手数料通貨,手数料数量,
//           送付元アドレス,送付先アドレス,登録番号,社名,備考
//
// 「増加通貨/減少通貨」の組み合わせで売買・交換を判別する一般的なフォーマット。
// 送付元/送付先アドレスが入っている行は入出金(送付・受取)であり課税イベントの
// 売買ではないため対象外とする。増加・減少の一方しか無い行(手数料のみ・
// 報酬受取など)は税務上の性質を一意に判定できないため、安全側に倒して
// 取り込み対象外とし、利用者に手動登録を促す。

const COINCHECK_REQUIRED = ["取引日時", "増加通貨名", "減少通貨名"];
const JPY_SYMBOL = "JPY";

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

    const dateValue = parseFlexibleDateTime(get("取引日時"));
    const increaseSymbol = (get("増加通貨名") ?? "").toUpperCase() || null;
    const decreaseSymbol = (get("減少通貨名") ?? "").toUpperCase() || null;
    const increaseQtyStr = normalizeNumericString(get("増加数量"));
    const decreaseQtyStr = normalizeNumericString(get("減少数量"));
    const settlementStr = normalizeNumericString(get("約定代金"));
    const priceStr = normalizeNumericString(get("約定価格"));

    if (!dateValue) {
      skippedRows.push({ lineNumber, reason: `取引日時を解釈できません: "${get("取引日時") ?? ""}"` });
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
      // 暗号資産を売却して日本円を得た
      const unitPrice = priceStr ? new Decimal(priceStr).abs() : increaseQty.dividedBy(decreaseQty);
      rows.push({
        tradedAt: dateValue,
        symbol: decreaseSymbol,
        type: "SELL",
        quantity: decreaseQty,
        unitPriceJpy: unitPrice,
        feeJpy,
        exchange: EXCHANGE_LABELS.coincheck,
        memo,
      });
    } else if (decreaseSymbol === JPY_SYMBOL && increaseSymbol !== JPY_SYMBOL) {
      // 日本円を支払って暗号資産を購入した
      const unitPrice = priceStr ? new Decimal(priceStr).abs() : decreaseQty.dividedBy(increaseQty);
      rows.push({
        tradedAt: dateValue,
        symbol: increaseSymbol,
        type: "BUY",
        quantity: increaseQty,
        unitPriceJpy: unitPrice,
        feeJpy,
        exchange: EXCHANGE_LABELS.coincheck,
        memo,
      });
    } else if (increaseSymbol !== JPY_SYMBOL && decreaseSymbol !== JPY_SYMBOL) {
      // 暗号資産同士の交換。円換算額(約定代金)を両建てのレートとして使う。
      const jpyValue = settlement ?? (priceStr ? new Decimal(priceStr).abs().times(decreaseQty) : null);
      if (!jpyValue) {
        skippedRows.push({
          lineNumber,
          reason: "暗号資産同士の交換で円換算額(約定代金/約定価格)を解釈できません",
        });
        continue;
      }
      rows.push({
        tradedAt: dateValue,
        symbol: decreaseSymbol,
        type: "TRADE_OUT",
        quantity: decreaseQty,
        unitPriceJpy: jpyValue.dividedBy(decreaseQty),
        feeJpy,
        exchange: EXCHANGE_LABELS.coincheck,
        memo,
      });
      rows.push({
        tradedAt: dateValue,
        symbol: increaseSymbol,
        type: "TRADE_IN",
        quantity: increaseQty,
        unitPriceJpy: jpyValue.dividedBy(increaseQty),
        feeJpy: new Decimal(0),
        exchange: EXCHANGE_LABELS.coincheck,
        memo,
      });
    } else {
      // 増加通貨=減少通貨=JPY等、想定外の組み合わせ
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
  if (!feeQtyStr) return new Decimal(0);
  // 手数料が暗号資産建ての場合は円換算レートが無く安全に換算できないため、
  // 円建て(JPY)の手数料のみを取り込む。暗号資産建て手数料は無視される
  // (雑所得の計算上わずかな差異が生じ得るため、正確を期す場合は手動調整のこと)。
  if (feeCurrency !== JPY_SYMBOL) return new Decimal(0);
  return new Decimal(feeQtyStr).abs();
}

// ---------------------------------------------------------------------------
// GMOコイン
// ---------------------------------------------------------------------------
// ヘッダー(現物・証拠金・入出金が1ファイルに混在): 日時,精算区分,
//   日本円受渡金額,注文ID,約定ID,建玉ID,銘柄名,注文タイプ,取引区分,
//   売買区分,執行条件,約定数量,約定レート,約定金額,注文手数料,
//   レバレッジ手数料,入出金区分,入出金金額,授受区分,数量,送付手数料,
//   送付先/送付元,トランザクションID
//
// 取引区分が「現物」の行のみを現物売買として取り込む。証拠金取引・
// 入出金・送付の行は対象外とする。

const GMO_REQUIRED = ["日時", "取引区分", "銘柄名", "売買区分", "約定数量", "約定レート"];

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
    const dateValue = parseFlexibleDateTime(get("日時"));

    if (!symbol || !quantityStr || !priceStr || !dateValue) {
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
      tradedAt: dateValue,
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
