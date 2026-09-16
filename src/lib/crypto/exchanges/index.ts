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
}
