import { Decimal } from "decimal.js";
<<<<<<< HEAD
import type { CryptoTradeType } from "../calculator";

/**
 * 暗号資産取引所からエクスポートしたCSVを、本ツール共通の取引形式に変換する
 * パーサーの共通インターフェース。取引所ごとにCSVフォーマットが異なるため、
 * 取引所ごとに `src/lib/crypto/exchanges/` 配下へパーサーを追加していく。
 *
 * 解釈できない行(未対応の取引種別・日付や金額の形式異常など)は例外にせず
 * skippedRows に理由を記録して処理を継続する
 * (`src/lib/moneyforward/parseCashflow.ts` と同じ方針)。
 */
export interface ExchangeTradeRow {
  tradedAt: Date;
=======
import type { CryptoTradeType } from "@/lib/crypto/calculator";

/**
 * 暗号資産取引所からエクスポートされた取引履歴CSVを、
 * CryptoTrade(手入力フォームと同じ形)に変換した結果の1行。
 */
export interface ExchangeCryptoTradeRow {
  tradedAt: Date;
  /** 銘柄シンボル (例: BTC) */
>>>>>>> origin/claude/wonderful-edison-xzm3zs
  symbol: string;
  type: CryptoTradeType;
  quantity: Decimal;
  unitPriceJpy: Decimal;
  feeJpy: Decimal;
  memo: string | null;
}

<<<<<<< HEAD
export interface ExchangeCsvParseSkip {
=======
export interface ExchangeParseSkip {
>>>>>>> origin/claude/wonderful-edison-xzm3zs
  lineNumber: number;
  reason: string;
}

<<<<<<< HEAD
export interface ExchangeCsvParseResult {
  rows: ExchangeTradeRow[];
  skippedRows: ExchangeCsvParseSkip[];
}

export type ExchangeCsvParser = (csvText: string) => ExchangeCsvParseResult;

export interface ExchangeCsvFormat {
  /** データベースの CryptoTrade.exchange / ImportBatch.sourceType に使うID */
  id: string;
  /** UI表示用の取引所名 */
  label: string;
  /** 対応範囲・既知の制約についての注記(UIに表示する) */
  notes: string;
  parse: ExchangeCsvParser;
}
=======
export interface ExchangeParseResult {
  rows: ExchangeCryptoTradeRow[];
  skippedRows: ExchangeParseSkip[];
}

export type CryptoExchangeId = "bitflyer" | "coincheck" | "gmo_coin";

export const CRYPTO_EXCHANGE_LABELS: Record<CryptoExchangeId, string> = {
  bitflyer: "bitFlyer",
  coincheck: "Coincheck",
  gmo_coin: "GMOコイン",
};

/** 法定通貨とみなすシンボル(この通貨との売買は円建て取引として扱う) */
export const FIAT_SYMBOL = "JPY";
>>>>>>> origin/claude/wonderful-edison-xzm3zs
