import { Decimal } from "decimal.js";
import { parseCsvRows } from "@/lib/csv";
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
      "Coincheckの取引履歴CSV形式として認識できませんでした。「業界標準フォーマット」でダウンロードしたCSVをそのままアップロードしてください。",
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
      });
      continue;
    }

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

    rows.push({
      tradedAt,
      symbol,
      type: isBuy ? "BUY" : "SELL",
      quantity: cryptoQuantity.abs(),
      unitPriceJpy: unitPrice.abs(),
      feeJpy,
      memo: get(cols, "memo")?.trim() || null,
    });
  }

  return { rows, skippedRows };
}
