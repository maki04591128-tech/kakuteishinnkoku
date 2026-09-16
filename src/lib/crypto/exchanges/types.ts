import { Decimal } from "decimal.js";
import type { CryptoTradeType } from "@/lib/crypto/calculator";

/**
 * 暗号資産取引所からエクスポートされた取引履歴CSVを、
 * CryptoTrade(手入力フォームと同じ形)に変換した結果の1行。
 */
export interface ExchangeCryptoTradeRow {
  tradedAt: Date;
  /** 銘柄シンボル (例: BTC) */
  symbol: string;
  type: CryptoTradeType;
  quantity: Decimal;
  unitPriceJpy: Decimal;
  feeJpy: Decimal;
  memo: string | null;
}

export interface ExchangeParseSkip {
  lineNumber: number;
  reason: string;
}

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
