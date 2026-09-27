import { Decimal } from "decimal.js";

/**
 * 暗号資産交換業者が不正流出・破綻等により預けていた暗号資産を返還できなくなり、
 * これに代えて金銭の補償を受けた場合の所得税の取扱いを試算する。
 *
 * 暗号資産が盗難・詐欺により消失した場合の雑損控除・必要経費算入の試算
 * (機能135。`lossDeduction.ts`)は、消失に対して一切の補償を受けられない
 * (対価が無い)ことを前提とする一般規定(所得税法72条・51条4項)に基づく試算
 * だったが、実際の交換業者の不正流出・破綻事案では、顧客が預けていた暗号資産に
 * 代えて金銭による補償(全額の場合もあれば、事案によっては一部のみの場合もある)を
 * 受けるケースが多い。この「補償を受けた場合」の取扱いは、機能135が対象外とした
 * 「今後の課題」(取引所の破綻による消失)のうち、少なくとも金銭の補償を受けた
 * ケースについて一次情報を確認できたため、別モジュールとして対応する。
 *
 * 国税庁タックスアンサーNo.1525「暗号資産交換業者から暗号資産に代えて金銭の
 * 補償を受けた場合」を一次情報として、次の取扱いを確認した。
 *
 *  - 一般に、損害賠償金として支払われる金銭であっても、本来所得となるべきもの
 *    または得られたであろう利益を喪失した部分の賠償であるときは非課税にならない。
 *  - 顧客から預かった暗号資産を返還できない場合に支払われる補償金は、返還できなく
 *    なった暗号資産に代えて支払われる金銭であり、その補償金と同額で暗号資産を
 *    売却したことにより金銭を得たのと同一の結果となることから、本来所得となる
 *    べきものまたは得られたであろう利益を喪失した部分が含まれているものと考え
 *    られる。したがって、この補償金は非課税となる損害賠償金には該当せず、
 *    原則として総合課税の雑所得の対象となる(所法35、36)。
 *  - 雑所得の対象となる補償金の計算の基礎となった1単位当たりの暗号資産の価額が
 *    もともとの取得単価よりも低額である場合には損失が生じることになり、その
 *    損失は他の雑所得の金額と通算することができる。
 *
 * 機能135(盗難・詐欺による消失で補償を一切受けられない場合)とは異なり、この
 * ケースは経済的には「補償金と同額で暗号資産を売却した」のと同じ結果になる
 * ため、暗号資産の売却(機能1の総平均法・移動平均法による取得費計算)と同じ
 * 構造で、収入金額(補償金額)から取得費を控除した金額がそのまま雑所得の金額
 * (マイナスの場合は他の雑所得と通算できる損失)になる。51条4項(必要経費算入。
 * 機能135)のような「その年分の雑所得の金額を限度」とする頭打ち制約は無く
 * (通常の暗号資産の売却損益の計算と同じ扱いのため)、72条1項(雑損控除)の
 * ような足切り計算も適用されない。
 */

export interface ExchangeCompensationEvent {
  /** 銘柄シンボル(例: BTC) */
  symbol: string;
  /**
   * 受け取った補償金額(円)。返還できなくなった暗号資産の保有数量に、補償金の
   * 計算の基礎となった1単位当たりの暗号資産の価額を乗じた金額。
   */
  compensationAmountJpy: Decimal.Value;
  /**
   * 返還できなくなった暗号資産の取得費(総平均法・移動平均法による取得価額。
   * `src/lib/crypto/calculator.ts`の計算結果を用いる)。
   */
  acquisitionCostJpy: Decimal.Value;
}

export interface ExchangeCompensationSymbolResult {
  symbol: string;
  eventCount: number;
  compensationAmountJpy: Decimal;
  acquisitionCostJpy: Decimal;
  /** 収入金額(補償金額)から取得費を控除した雑所得の金額(マイナスの場合は損失) */
  gainOrLossJpy: Decimal;
}

export interface ExchangeCompensationIncomeResult {
  bySymbol: ExchangeCompensationSymbolResult[];
  /** 補償金額の合計(総合課税の雑所得の収入金額) */
  totalCompensationAmountJpy: Decimal;
  totalAcquisitionCostJpy: Decimal;
  /** 雑所得の金額の合計(マイナスの場合は他の雑所得と通算できる損失) */
  totalGainOrLossJpy: Decimal;
  notes: string[];
}

function toDecimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateExchangeCompensationIncome(
  events: ExchangeCompensationEvent[],
): ExchangeCompensationIncomeResult {
  const bySymbolMap = new Map<string, ExchangeCompensationSymbolResult>();

  for (const event of events) {
    const symbol = event.symbol.trim();
    if (!symbol) {
      throw new Error("銘柄シンボルは必須です");
    }
    const compensationAmountJpy = toDecimal(event.compensationAmountJpy);
    const acquisitionCostJpy = toDecimal(event.acquisitionCostJpy);
    requireNonNegative(compensationAmountJpy, "補償金額");
    requireNonNegative(acquisitionCostJpy, "取得費");

    const gainOrLossJpy = compensationAmountJpy.minus(acquisitionCostJpy);

    const existing = bySymbolMap.get(symbol);
    if (existing) {
      existing.eventCount += 1;
      existing.compensationAmountJpy = existing.compensationAmountJpy.plus(compensationAmountJpy);
      existing.acquisitionCostJpy = existing.acquisitionCostJpy.plus(acquisitionCostJpy);
      existing.gainOrLossJpy = existing.gainOrLossJpy.plus(gainOrLossJpy);
    } else {
      bySymbolMap.set(symbol, {
        symbol,
        eventCount: 1,
        compensationAmountJpy,
        acquisitionCostJpy,
        gainOrLossJpy,
      });
    }
  }

  const bySymbol = Array.from(bySymbolMap.values()).sort((a, b) =>
    a.symbol.localeCompare(b.symbol),
  );

  const totalCompensationAmountJpy = bySymbol.reduce(
    (sum, r) => sum.plus(r.compensationAmountJpy),
    new Decimal(0),
  );
  const totalAcquisitionCostJpy = bySymbol.reduce(
    (sum, r) => sum.plus(r.acquisitionCostJpy),
    new Decimal(0),
  );
  const totalGainOrLossJpy = bySymbol.reduce(
    (sum, r) => sum.plus(r.gainOrLossJpy),
    new Decimal(0),
  );

  const notes: string[] = [
    "国税庁タックスアンサーNo.1525「暗号資産交換業者から暗号資産に代えて金銭の補償を受けた場合」に基づく試算。返還できなくなった暗号資産に代えて支払われる補償金は、その補償金と同額で暗号資産を売却したのと同一の結果になるため、非課税の損害賠償金には該当せず原則として総合課税の雑所得の対象となる(所法35、36)。",
    "収入金額(補償金額)から取得費(総平均法・移動平均法による取得価額)を控除した金額が雑所得の金額。補償金の計算基礎となった1単位当たりの価額が取得単価より低い場合はマイナス(損失)になり、他の雑所得の金額と通算できる(機能135の必要経費算入(51条4項)のような、その年分の雑所得の金額を限度とする頭打ちは無い)。",
    "この試算は、預けていた暗号資産の全部または一部について金銭の補償を受けたケースを対象とする。一切補償を受けられず消失した部分がある場合は、その部分については盗難・詐欺等の原因区分に応じた雑損控除・必要経費算入の試算(/crypto-loss-deduction。機能135参照)を別途行うこと。",
    "この試算結果(totalGainOrLossJpy)は、暗号資産の他の雑所得(現物取引・証拠金取引等)と合算してダッシュボード・下書きCSVに反映すること。この試算画面自体はDBへの登録機能を持たない。",
    "各金額は円未満の端数を切り捨てずDecimalの計算結果をそのまま返す概算値。",
  ];

  return {
    bySymbol,
    totalCompensationAmountJpy,
    totalAcquisitionCostJpy,
    totalGainOrLossJpy,
    notes,
  };
}
