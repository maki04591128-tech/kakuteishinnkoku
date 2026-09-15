import { Decimal } from "decimal.js";
import { parseCsvRows } from "@/lib/csv";
import { parseExchangeDateTime, parseExchangeDecimal } from "./parseUtil";
import { FIAT_SYMBOL, type ExchangeParseResult, type ExchangeParseSkip } from "./types";

/**
 * bitFlyer「お取引レポート」からダウンロードできる現物取引履歴CSV
 * (ファイル名例: TradeHistory_YYYYMMDD.csv)のパーサー。
 *
 * ヘッダー: 取引日時,通貨,取引種別,取引価格,通貨1,通貨1数量,手数料,
 *           通貨1の対円レート,通貨2,通貨2数量,自己・媒介,注文ID,備考
 *
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
  const csvRows = parseCsvRows(csvText);
  if (csvRows.length === 0) {
    return { rows: [], skippedRows: [] };
  }

  const headerRow = csvRows[0];
  const fieldIndex = new Map<string, number>();
  headerRow.forEach((header, index) => {
    const key = HEADER_ALIASES[header.trim()];
    if (key) fieldIndex.set(key, index);
  });

  const missingRequired = REQUIRED_FIELDS.filter((f) => !fieldIndex.has(f));
  if (missingRequired.length > 0) {
    throw new Error(
      "bitFlyerの取引履歴CSV形式として認識できませんでした。「お取引レポート」の現物取引CSVをそのままアップロードしてください。",
    );
  }

  const get = (cols: string[], key: string): string | undefined => {
    const index = fieldIndex.get(key);
    if (index === undefined) return undefined;
    return cols[index];
  };

  const rows: ExchangeParseResult["rows"] = [];
  const skippedRows: ExchangeParseSkip[] = [];

  for (let i = 1; i < csvRows.length; i++) {
    const cols = csvRows[i];
    const lineNumber = i + 1;

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
      });
      continue;
    }

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
    });
  }

  return { rows, skippedRows };
}
