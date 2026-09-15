import { parseBitflyerTradeHistoryCsv } from "./bitflyer";
import { parseCoincheckStandardCsv } from "./coincheck";
import type { ExchangeCsvFormat } from "./types";

export type { ExchangeCsvParseResult, ExchangeTradeRow } from "./types";

/**
 * 対応済みの暗号資産取引所CSVフォーマット一覧。
 * ここに追加していくことで /import 画面の選択肢が増える。
 */
export const EXCHANGE_CSV_FORMATS: ExchangeCsvFormat[] = [
  {
    id: "bitflyer",
    label: "bitFlyer(現物・お取引レポート)",
    notes:
      "JPY建てペア(BTC_JPY等)の現物取引のみ対応。アルトコイン間ペア・入出金は非対応。",
    parse: parseBitflyerTradeHistoryCsv,
  },
  {
    id: "coincheck",
    label: "Coincheck(業界標準フォーマット)",
    notes: "現物の買い(buy)/売り(sell)のみ対応。入出金は非対応。",
    parse: parseCoincheckStandardCsv,
  },
];

export function findExchangeCsvFormat(id: string): ExchangeCsvFormat | undefined {
  return EXCHANGE_CSV_FORMATS.find((f) => f.id === id);
}
