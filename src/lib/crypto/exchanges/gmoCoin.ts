import { Decimal } from "decimal.js";
import { parseCsvRows } from "@/lib/csv";
import { parseExchangeDateTime, parseExchangeDecimal } from "./parseUtil";
import type { ExchangeParseResult, ExchangeParseSkip } from "./types";

/**
 * GMOコインの会員ページ「明細」→「CSV」からダウンロードできる取引履歴CSVのパーサー。
 *
 * ヘッダー: 日時,精算区分,日本円受渡金額,注文ID,約定ID,建玉ID,銘柄名,注文タイプ,
 *           取引区分,売買区分,執行条件,約定数量,約定レート,約定金額,注文手数料,
 *           レバレッジ手数料,入出金区分,入出金金額,授受区分,数量,送付手数料,
 *           送付先/送付元,トランザクションID
 *
 * このCSVは現物取引・レバレッジ(FX)取引・入出金・送付が1ファイルに混在する。
 * 「取引区分」に"現物"を含まない行(レバレッジ取引)や、約定数量・約定レートが
 * 空の行(入出金・送付)はスキップし、現物の売買行のみを取り込む。
 */

const HEADER_ALIASES: Record<string, string> = {
  日時: "tradedAt",
  銘柄名: "symbol",
  取引区分: "category",
  売買区分: "side",
  約定数量: "quantity",
  約定レート: "rate",
  注文手数料: "fee",
};

const REQUIRED_FIELDS = ["tradedAt", "symbol", "side", "quantity", "rate"] as const;

export function parseGmoCoinCsv(csvText: string): ExchangeParseResult {
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
      "GMOコインの取引履歴CSV形式として認識できませんでした。「明細」→「CSV」でダウンロードしたCSVをそのままアップロードしてください。",
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
    const symbolRaw = (get(cols, "symbol") ?? "").trim().toUpperCase();
    const category = (get(cols, "category") ?? "").trim();
    const sideRaw = (get(cols, "side") ?? "").trim();
    const quantity = parseExchangeDecimal(get(cols, "quantity"));
    const rate = parseExchangeDecimal(get(cols, "rate"));

    if (!tradedAt) {
      skippedRows.push({ lineNumber, reason: `日時を解釈できません: "${get(cols, "tradedAt")}"` });
      continue;
    }
    if (category !== "" && !category.includes("現物")) {
      skippedRows.push({ lineNumber, reason: `現物取引以外(${category})のためスキップしました` });
      continue;
    }
    if (!symbolRaw || quantity === null || quantity.isZero() || rate === null) {
      skippedRows.push({ lineNumber, reason: "入出金・送付など売買以外の行のためスキップしました" });
      continue;
    }

    let type: "BUY" | "SELL";
    if (sideRaw.includes("買")) {
      type = "BUY";
    } else if (sideRaw.includes("売")) {
      type = "SELL";
    } else {
      skippedRows.push({ lineNumber, reason: `売買区分を解釈できません: "${sideRaw}"` });
      continue;
    }

    const feeJpy = (parseExchangeDecimal(get(cols, "fee")) ?? new Decimal(0)).abs();
    const symbol = symbolRaw.replace(/_JPY$/, "");

    rows.push({
      tradedAt,
      symbol,
      type,
      quantity: quantity.abs(),
      unitPriceJpy: rate.abs(),
      feeJpy,
      memo: null,
    });
  }

  return { rows, skippedRows };
}
