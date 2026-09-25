import { Decimal } from "decimal.js";

/**
 * 上場株式等の信用取引(制度信用取引・一般信用取引)の年間決済損益計算。
 *
 * 国税庁法令解釈通達(措置法通達37の10-5・37の11共通「信用取引等に係る
 * 譲渡益の計算」)により、信用取引の譲渡益は決済(反対売買・差金決済)の都度、
 * その決済に係る譲渡収入金額からその株式等の取得に要した金額を差し引いて計算する。
 * 現物取引(InvestmentTrade)のように数量×単価で取得費を積み上げる総平均法に
 * 準ずる方法の対象にはあてはまらず、暗号資産の証拠金取引(CryptoMarginTrade)と
 * 同様、決済ごとに確定する損益をそのまま合算するだけのシンプルな計算になる。
 *
 * ただし課税区分は暗号資産の証拠金取引(雑所得)や先物取引(先物取引に係る
 * 雑所得等)とは異なり、現物の上場株式等と同じ「上場株式等に係る譲渡所得等」
 * (申告分離課税・税率20.315%)のプールに合算され、上場株式等の譲渡損失の
 * 繰越控除(措置法37の12の2)の対象にもなる。そのため本モジュールの計算結果は
 * `src/lib/investment/calculator.ts`が計算する現物取引分の譲渡損益と合算した上で
 * `lossCarryforward.ts`に渡す(`src/lib/reporting.ts`参照)。信用取引にNISA口座は
 * 適用されない。
 *
 * 取得費に算入すべき建玉の金利相当額(買い方が支払う分)・品貸料(買い方が受け取る分)・
 * 売り方が支払う品貸料・売り方が受け取る金利相当額・配当落調整額(権利処理価額)は、
 * いずれも証券会社の取引報告書に記載された金額をユーザー自身が`interestAdjustmentJpy`
 * (純額。収入超過ならプラス、費用超過ならマイナス)にまとめて入力する前提とし、
 * 個別の内訳フィールドには分解しない(実務上、報告書上で既に純額表示されることが多いため)。
 */

export interface StockMarginTradeInput {
  /** 決済損益(円)。建玉を閉じた際の値洗い損益で、損失の場合は負の値。 */
  realizedPnlJpy: Decimal.Value;
  /** 売買手数料(円)。決済損益から差し引く。0以上である必要がある。 */
  feeJpy?: Decimal.Value;
  /**
   * 金利相当額・品貸料・配当落調整額(権利処理価額)の純額調整(円)。
   * 収入超過(受取超過)の場合はプラス、費用超過(支払超過)の場合はマイナス。
   */
  interestAdjustmentJpy?: Decimal.Value;
}

export interface StockMarginSymbolYearResult {
  symbol: string;
  /** 決済件数 */
  settlementCount: number;
  /** 決済損益の合計(手数料・金利等調整前) */
  grossPnlJpy: Decimal;
  /** 手数料の合計 */
  feeJpy: Decimal;
  /** 金利相当額・品貸料・配当落調整額の純額調整の合計 */
  interestAdjustmentJpy: Decimal;
  /** 上場株式等の譲渡所得に算入する損益(決済損益 - 手数料 + 金利等純額調整) */
  realizedGainJpy: Decimal;
}

export interface StockMarginPortfolioYearResult {
  bySymbol: StockMarginSymbolYearResult[];
  /** 全銘柄合計の譲渡所得金額(信用取引分。上場株式等の現物取引分と合算して繰越控除の計算に使う) */
  totalRealizedGainJpy: Decimal;
}

function toDecimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

/**
 * 単一銘柄の1年分の決済損益を集計する。
 * 現物取引と異なり取引の前後関係や保有数量に依存しないため、順序は結果に影響しない。
 */
export function calculateStockMarginYear(
  symbol: string,
  trades: StockMarginTradeInput[],
): StockMarginSymbolYearResult {
  let grossPnlJpy = new Decimal(0);
  let feeJpy = new Decimal(0);
  let interestAdjustmentJpy = new Decimal(0);

  for (const trade of trades) {
    const pnl = toDecimal(trade.realizedPnlJpy);
    const fee = trade.feeJpy !== undefined ? toDecimal(trade.feeJpy) : new Decimal(0);
    const adjustment =
      trade.interestAdjustmentJpy !== undefined
        ? toDecimal(trade.interestAdjustmentJpy)
        : new Decimal(0);

    if (fee.isNegative()) {
      throw new Error(`手数料は0以上である必要があります (symbol=${symbol})`);
    }

    grossPnlJpy = grossPnlJpy.plus(pnl);
    feeJpy = feeJpy.plus(fee);
    interestAdjustmentJpy = interestAdjustmentJpy.plus(adjustment);
  }

  const realizedGainJpy = grossPnlJpy.minus(feeJpy).plus(interestAdjustmentJpy);

  return {
    symbol,
    settlementCount: trades.length,
    grossPnlJpy,
    feeJpy,
    interestAdjustmentJpy,
    realizedGainJpy,
  };
}

/**
 * 複数銘柄が混在した決済一覧を銘柄別に集計し、全体の譲渡所得合計を計算する。
 */
export function calculateStockMarginPortfolioYear(
  trades: (StockMarginTradeInput & { symbol: string })[],
): StockMarginPortfolioYearResult {
  const tradesBySymbol = new Map<string, StockMarginTradeInput[]>();
  for (const trade of trades) {
    const list = tradesBySymbol.get(trade.symbol) ?? [];
    list.push(trade);
    tradesBySymbol.set(trade.symbol, list);
  }

  const bySymbol = Array.from(tradesBySymbol.entries())
    .map(([symbol, symbolTrades]) => calculateStockMarginYear(symbol, symbolTrades))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  const totalRealizedGainJpy = bySymbol.reduce(
    (sum, result) => sum.plus(result.realizedGainJpy),
    new Decimal(0),
  );

  return { bySymbol, totalRealizedGainJpy };
}
