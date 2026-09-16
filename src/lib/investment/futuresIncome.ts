import { Decimal } from "decimal.js";

/**
 * FX(店頭外国為替証拠金取引)・先物・CFD等の年間損益計算(先物取引に係る雑所得等)。
 *
 * 所得税法上、これらの決済損益は「先物取引に係る雑所得等」として、上場株式等の
 * 譲渡所得(src/lib/investment/calculator.ts)や暗号資産の雑所得
 * (src/lib/crypto/calculator.ts・marginCalculator.ts)とは別区分の申告分離課税
 * (一律20.315%)の対象になる。同じ「申告分離課税」でも所得区分そのものが異なる
 * ため、上場株式等の譲渡損失とは損益通算できず、繰越控除(3年間)も別プールで
 * 管理しなければならない(src/lib/investment/lossCarryforward.ts の
 * calculateLossCarryforward を本区分用のエントリで別途呼び出して使う)。
 *
 * CryptoMarginTradeと同様、数量×単価で取得費を積み上げる総平均法/移動平均法の
 * 計算モデルにはあてはまらず、建玉の決済(反対売買・差金決済)のたびに確定する
 * 損益をそのまま合算するだけのシンプルな計算になる。
 */

export interface FuturesTradeInput {
  /** 決済損益(円)。損失の場合は負の値。 */
  realizedPnlJpy: Decimal.Value;
  /** 取引手数料(円)。決済損益から差し引く。0以上である必要がある。 */
  feeJpy?: Decimal.Value;
  /** スワップポイント等(円。FXのみ)。損益に加算する(費用の場合は負の値)。 */
  swapJpy?: Decimal.Value;
}

export interface FuturesSymbolYearResult {
  symbol: string;
  /** 決済件数 */
  settlementCount: number;
  /** 決済損益の合計(手数料・スワップ控除前) */
  grossPnlJpy: Decimal;
  /** 手数料の合計 */
  feeJpy: Decimal;
  /** スワップポイント等の合計 */
  swapJpy: Decimal;
  /** 先物取引に係る雑所得等に算入する損益(決済損益 - 手数料 + スワップ) */
  realizedGainJpy: Decimal;
}

export interface FuturesPortfolioYearResult {
  bySymbol: FuturesSymbolYearResult[];
  /** 全銘柄合計の先物取引に係る雑所得等の金額(繰越控除適用前) */
  totalRealizedGainJpy: Decimal;
}

function toDecimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

/**
 * 単一銘柄の1年分の決済損益を集計する。
 * 現物取引と異なり取引の前後関係や保有数量に依存しないため、順序は結果に影響しない。
 */
export function calculateFuturesYear(
  symbol: string,
  trades: FuturesTradeInput[],
): FuturesSymbolYearResult {
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
export function calculateFuturesPortfolioYear(
  trades: (FuturesTradeInput & { symbol: string })[],
): FuturesPortfolioYearResult {
  const tradesBySymbol = new Map<string, FuturesTradeInput[]>();
  for (const trade of trades) {
    const list = tradesBySymbol.get(trade.symbol) ?? [];
    list.push(trade);
    tradesBySymbol.set(trade.symbol, list);
  }

  const bySymbol = Array.from(tradesBySymbol.entries())
    .map(([symbol, symbolTrades]) => calculateFuturesYear(symbol, symbolTrades))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  const totalRealizedGainJpy = bySymbol.reduce(
    (sum, result) => sum.plus(result.realizedGainJpy),
    new Decimal(0),
  );

  return { bySymbol, totalRealizedGainJpy };
}
