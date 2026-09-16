<<<<<<< HEAD
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
=======
import { parseBitflyerCsv } from "./bitflyer";
import { parseCoincheckCsv } from "./coincheck";
import { parseGmoCoinCsv } from "./gmoCoin";
import type { CryptoExchangeId, ExchangeParseResult } from "./types";

export {
  type CryptoExchangeId,
  CRYPTO_EXCHANGE_LABELS,
  type ExchangeCryptoTradeRow,
  type ExchangeParseResult,
  type ExchangeParseSkip,
} from "./types";

/** 取引所ごとの取引履歴CSVを共通形式にパースする */
export function parseCryptoExchangeCsv(
  exchange: CryptoExchangeId,
  csvText: string,
): ExchangeParseResult {
  switch (exchange) {
    case "bitflyer":
      return parseBitflyerCsv(csvText);
    case "coincheck":
      return parseCoincheckCsv(csvText);
    case "gmo_coin":
      return parseGmoCoinCsv(csvText);
    default: {
      const _exhaustive: never = exchange;
      throw new Error(`未対応の取引所です: ${_exhaustive as string}`);
    }
  }
>>>>>>> origin/claude/wonderful-edison-xzm3zs
}
