import { Decimal } from "decimal.js";
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
  symbol: string;
  type: CryptoTradeType;
  quantity: Decimal;
  unitPriceJpy: Decimal;
  feeJpy: Decimal;
  memo: string | null;
}

export interface ExchangeCsvParseSkip {
  lineNumber: number;
  reason: string;
}

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
