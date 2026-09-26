import { Decimal } from "decimal.js";

/**
 * 暗号資産の信用取引の年間決済損益計算。
 *
 * 国税庁「暗号資産等に関する税務上の取扱いについて(FAQ)」問2-13「暗号資産の
 * 信用取引」(令和6年12月更新)により、暗号資産信用取引(他の者から信用の
 * 供与を受けて行う暗号資産の売買)を行った場合の所得金額は、暗号資産の
 * 売付け価額(注1)とその買付けに係る対価の額(注2)との差額(譲渡原価は
 * 個別法により計算)となり、決済(反対売買)の日の属する年分の所得となる。
 * (注)1  売付けを行う者が他の者から支払を受ける金利は売付け価額に含め、他の者に
 *        支払う品貸料は売付け価額から控除する。
 *     2  買付けを行う者が他の者に支払う金利は買付け価額に含め、他の者から支払を
 *        受ける品貸料は買付け価額から控除する。
 *
 * 同FAQ問2-12「暗号資産の証拠金取引」(証拠金(レバレッジ)取引。
 * `src/lib/crypto/marginCalculator.ts`)とは、他の者から現物の暗号資産の
 * 信用供与を受けて売買する点で異なる別の取引類型(信用取引は所令119条の7・
 * 所基通達36・37共-22、証拠金取引は措法41条の14による申告分離課税の除外)
 * だが、いずれも個人については雑所得として総合課税される点は共通のため
 * (問2-12の答で「暗号資産の証拠金取引…総合課税の対象になります」、問2-13は
 * 所得区分そのものは問2-2「暗号資産取引の所得区分」の原則どおり雑所得)、
 * 本ツールでは現物取引(CryptoTrade)・証拠金取引(CryptoMarginTrade)と合算した
 * 一つの雑所得(暗号資産)のプールとして扱う(`src/lib/reporting.ts`参照)。
 * 上場株式等の信用取引(`src/lib/investment/marginCalculator.ts`)と異なり、
 * 上場株式等に係る譲渡所得等のプールには合算されず、譲渡損失の繰越控除の
 * 対象にもならない(暗号資産の雑所得の損失は他の所得と損益通算できず、
 * 翌年以後への繰越控除もできない原則どおり)。
 *
 * 現物取引のように数量×単価で取得費を積み上げる総平均法/移動平均法の
 * 計算モデルにはあてはまらず、決済ごとに確定する損益をそのまま合算するだけの
 * シンプルな計算になる点は証拠金取引・上場株式等の信用取引と同じ。金利相当額・
 * 品貸料は取引所の取引報告書に記載された金額をユーザー自身が
 * `interestAdjustmentJpy`(純額。受取超過ならプラス、支払超過ならマイナス)に
 * まとめて入力する前提とし、上場株式等の信用取引と同様、内訳フィールドには
 * 分解しない。
 */

export interface CryptoCreditTradeInput {
  /** 決済損益(円)。売付け価額と買付け価額の差額(個別法)で、損失の場合は負の値。 */
  realizedPnlJpy: Decimal.Value;
  /** 取引手数料(円)。決済損益から差し引く。0以上である必要がある。 */
  feeJpy?: Decimal.Value;
  /**
   * 金利相当額・品貸料の純額調整(円)。受取超過(収入超過)の場合はプラス、
   * 支払超過(費用超過)の場合はマイナス。
   */
  interestAdjustmentJpy?: Decimal.Value;
}

export interface CryptoCreditSymbolYearResult {
  symbol: string;
  /** 決済件数 */
  settlementCount: number;
  /** 決済損益の合計(手数料・金利等調整前) */
  grossPnlJpy: Decimal;
  /** 手数料の合計 */
  feeJpy: Decimal;
  /** 金利相当額・品貸料の純額調整の合計 */
  interestAdjustmentJpy: Decimal;
  /** 雑所得に算入する損益(決済損益 - 手数料 + 金利等純額調整) */
  realizedGainJpy: Decimal;
}

export interface CryptoCreditPortfolioYearResult {
  bySymbol: CryptoCreditSymbolYearResult[];
  /** 全銘柄合計の雑所得金額(信用取引分。現物取引・証拠金取引分と合算して雑所得(暗号資産)の総額を計算する) */
  totalRealizedGainJpy: Decimal;
}

function toDecimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

/**
 * 単一銘柄の1年分の決済損益を集計する。
 * 現物取引と異なり取引の前後関係や保有数量に依存しないため、順序は結果に影響しない。
 */
export function calculateCryptoCreditYear(
  symbol: string,
  trades: CryptoCreditTradeInput[],
): CryptoCreditSymbolYearResult {
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
 * 複数銘柄が混在した決済一覧を銘柄別に集計し、全体の雑所得合計を計算する。
 */
export function calculateCryptoCreditPortfolioYear(
  trades: (CryptoCreditTradeInput & { symbol: string })[],
): CryptoCreditPortfolioYearResult {
  const tradesBySymbol = new Map<string, CryptoCreditTradeInput[]>();
  for (const trade of trades) {
    const list = tradesBySymbol.get(trade.symbol) ?? [];
    list.push(trade);
    tradesBySymbol.set(trade.symbol, list);
  }

  const bySymbol = Array.from(tradesBySymbol.entries())
    .map(([symbol, symbolTrades]) => calculateCryptoCreditYear(symbol, symbolTrades))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  const totalRealizedGainJpy = bySymbol.reduce(
    (sum, result) => sum.plus(result.realizedGainJpy),
    new Decimal(0),
  );

  return { bySymbol, totalRealizedGainJpy };
}
