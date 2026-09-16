import { Decimal } from "decimal.js";

/**
 * 暗号資産の証拠金(レバレッジ)取引の年間損益計算。
 *
 * DMM Bitcoin・SBI VCトレード等の証拠金取引は、現物取引(CryptoTrade)のように
 * 数量×単価で取得費を積み上げる総平均法/移動平均法の計算モデルにはあてはまらず、
 * 決済(反対売買)のたびに確定する建玉損益がそのまま雑所得の収入・損失になる。
 * そのため、期首残高や取得原価の概念を持たず、決済ごとの損益(手数料・スワップ
 * 込み)を単純に合算するだけのシンプルな計算になる。
 */

export interface CryptoMarginTradeInput {
  /** 決済損益(円)。損失の場合は負の値。 */
  realizedPnlJpy: Decimal.Value;
  /** 取引手数料(円)。決済損益から差し引く。0以上である必要がある。 */
  feeJpy?: Decimal.Value;
  /** スワップポイント・建玉管理料等(円)。損益に加算する(費用の場合は負の値)。 */
  swapJpy?: Decimal.Value;
}

export interface CryptoMarginSymbolYearResult {
  symbol: string;
  /** 決済件数 */
  settlementCount: number;
  /** 決済損益の合計(手数料・スワップ控除前) */
  grossPnlJpy: Decimal;
  /** 手数料の合計 */
  feeJpy: Decimal;
  /** スワップポイント等の合計 */
  swapJpy: Decimal;
  /** 雑所得に算入する損益(決済損益 - 手数料 + スワップ) */
  realizedGainJpy: Decimal;
}

export interface CryptoMarginPortfolioYearResult {
  bySymbol: CryptoMarginSymbolYearResult[];
  /** 全銘柄合計の雑所得金額(証拠金取引分) */
  totalRealizedGainJpy: Decimal;
}

function toDecimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

/**
 * 単一銘柄の1年分の決済損益を集計する。
 * 現物取引と異なり取引の前後関係や保有数量に依存しないため、順序は結果に影響しない。
 */
export function calculateCryptoMarginYear(
  symbol: string,
  trades: CryptoMarginTradeInput[],
): CryptoMarginSymbolYearResult {
  let grossPnlJpy = new Decimal(0);
  let feeJpy = new Decimal(0);
  let swapJpy = new Decimal(0);

  for (const trade of trades) {
    const pnl = toDecimal(trade.realizedPnlJpy);
    const fee = trade.feeJpy !== undefined ? toDecimal(trade.feeJpy) : new Decimal(0);
    const swap = trade.swapJpy !== undefined ? toDecimal(trade.swapJpy) : new Decimal(0);

    if (fee.isNegative()) {
      throw new Error(`手数料は0以上である必要があります (symbol=${symbol})`);
    }

    grossPnlJpy = grossPnlJpy.plus(pnl);
    feeJpy = feeJpy.plus(fee);
    swapJpy = swapJpy.plus(swap);
  }

  const realizedGainJpy = grossPnlJpy.minus(feeJpy).plus(swapJpy);

  return {
    symbol,
    settlementCount: trades.length,
    grossPnlJpy,
    feeJpy,
    swapJpy,
    realizedGainJpy,
  };
}

/**
 * 複数銘柄が混在した決済一覧を銘柄別に集計し、全体の雑所得合計を計算する。
 */
export function calculateCryptoMarginPortfolioYear(
  trades: (CryptoMarginTradeInput & { symbol: string })[],
): CryptoMarginPortfolioYearResult {
  const tradesBySymbol = new Map<string, CryptoMarginTradeInput[]>();
  for (const trade of trades) {
    const list = tradesBySymbol.get(trade.symbol) ?? [];
    list.push(trade);
    tradesBySymbol.set(trade.symbol, list);
  }

  const bySymbol = Array.from(tradesBySymbol.entries())
    .map(([symbol, symbolTrades]) => calculateCryptoMarginYear(symbol, symbolTrades))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  const totalRealizedGainJpy = bySymbol.reduce(
    (sum, result) => sum.plus(result.realizedGainJpy),
    new Decimal(0),
  );

  return { bySymbol, totalRealizedGainJpy };
}
