import { Decimal } from "decimal.js";

/**
 * 暗号資産(仮想通貨)の年間損益計算。
 *
 * 国税庁「暗号資産に関する税務上の取扱いについて(FAQ)」に基づき、
 * 総平均法(その年の期首残高+年間取得分を合算した加重平均単価を
 * その年の全ての譲渡に適用する方法)で1単位あたりの取得価額を算出する。
 * 個人が届出により移動平均法を選択することも認められているが、
 * 未選択の場合は総平均法が法定算出方法となるため、まずはこちらを実装する。
 */

export type CryptoTradeType =
  | "BUY"
  | "SELL"
  | "TRADE_IN"
  | "TRADE_OUT"
  | "INCOME"
  | "FEE";

export interface CryptoTradeInput {
  type: CryptoTradeType;
  /** 数量(必ず正の値) */
  quantity: Decimal.Value;
  /** 日本円換算の単価。BUY/TRADE_IN/INCOMEは取得時時価、SELL/TRADE_OUT/FEEは譲渡・使用時時価。 */
  unitPriceJpy: Decimal.Value;
  /** 日本円換算の手数料(円建てで支払われた場合)。暗号資産建て手数料は type: "FEE" の別取引として渡す。 */
  feeJpy?: Decimal.Value;
}

export interface CryptoOpeningBalance {
  /** 前年末時点の保有数量 */
  quantity: Decimal.Value;
  /** 前年末時点の取得価額の合計(単価ではなく総額) */
  costBasisJpy: Decimal.Value;
}

export interface CryptoSymbolYearResult {
  symbol: string;
  openingQuantity: Decimal;
  openingCostJpy: Decimal;
  acquiredQuantity: Decimal;
  acquiredCostJpy: Decimal;
  /** その年の総平均法単価。保有・取得が無い場合は 0。 */
  averageUnitCostJpy: Decimal;
  /** 受贈・マイニング・ステーキング等、取得時点で収入計上すべき金額 */
  incomeJpy: Decimal;
  disposedQuantity: Decimal;
  /** 売却・使用・交換による収入(譲渡対価)の合計 */
  proceedsJpy: Decimal;
  /** 譲渡した数量に対応する取得原価(=平均単価×譲渡数量) */
  costOfDisposedJpy: Decimal;
  /** 雑所得に算入する損益(譲渡損益 + 受取時収入) */
  realizedGainJpy: Decimal;
  closingQuantity: Decimal;
  /** 翌年に繰り越す取得価額の合計(=平均単価×期末数量) */
  closingCostJpy: Decimal;
}

const ACQUIRE_TYPES: ReadonlySet<CryptoTradeType> = new Set([
  "BUY",
  "TRADE_IN",
  "INCOME",
]);
const DISPOSE_TYPES: ReadonlySet<CryptoTradeType> = new Set([
  "SELL",
  "TRADE_OUT",
  "FEE",
]);

function toDecimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

/**
 * 単一銘柄の1年分の取引から損益を計算する。
 * trades の順序は結果に影響しない(総平均法は年間合計でのみ決まるため)。
 */
export function calculateCryptoYear(
  symbol: string,
  trades: CryptoTradeInput[],
  opening?: CryptoOpeningBalance,
): CryptoSymbolYearResult {
  const openingQuantity = opening ? toDecimal(opening.quantity) : new Decimal(0);
  const openingCostJpy = opening ? toDecimal(opening.costBasisJpy) : new Decimal(0);

  if (openingQuantity.isNegative() || openingCostJpy.isNegative()) {
    throw new Error("期首残高の数量・取得価額は0以上である必要があります");
  }

  let acquiredQuantity = new Decimal(0);
  let acquiredCostJpy = new Decimal(0);
  let incomeJpy = new Decimal(0);
  let disposedQuantity = new Decimal(0);
  let proceedsJpy = new Decimal(0);

  for (const trade of trades) {
    const quantity = toDecimal(trade.quantity);
    const unitPrice = toDecimal(trade.unitPriceJpy);
    const fee = trade.feeJpy !== undefined ? toDecimal(trade.feeJpy) : new Decimal(0);

    if (quantity.isNegative() || quantity.isZero()) {
      throw new Error(`数量は正の値である必要があります (symbol=${symbol})`);
    }
    if (unitPrice.isNegative() || fee.isNegative()) {
      throw new Error(`単価・手数料は0以上である必要があります (symbol=${symbol})`);
    }

    const grossValue = quantity.times(unitPrice);

    if (ACQUIRE_TYPES.has(trade.type)) {
      acquiredQuantity = acquiredQuantity.plus(quantity);
      acquiredCostJpy = acquiredCostJpy.plus(grossValue).plus(fee);
      if (trade.type === "INCOME") {
        // マイニング・ステーキング・エアドロップ等は受取時点の時価が雑所得の収入金額。
        // 同額が取得価額としてプールされるため、将来売却時の二重課税は生じない。
        incomeJpy = incomeJpy.plus(grossValue);
      }
    } else if (DISPOSE_TYPES.has(trade.type)) {
      disposedQuantity = disposedQuantity.plus(quantity);
      proceedsJpy = proceedsJpy.plus(grossValue).minus(fee);
    } else {
      throw new Error(`未対応の取引種別です: ${trade.type as string}`);
    }
  }

  const totalQuantity = openingQuantity.plus(acquiredQuantity);
  const totalCost = openingCostJpy.plus(acquiredCostJpy);
  const averageUnitCostJpy = totalQuantity.isZero()
    ? new Decimal(0)
    : totalCost.dividedBy(totalQuantity);

  if (disposedQuantity.greaterThan(totalQuantity)) {
    throw new Error(
      `期首保有数量+年間取得数量(${totalQuantity.toString()})を超える数量(${disposedQuantity.toString()})が譲渡されています (symbol=${symbol})`,
    );
  }

  const costOfDisposedJpy = averageUnitCostJpy.times(disposedQuantity);
  const disposalGainJpy = proceedsJpy.minus(costOfDisposedJpy);
  const realizedGainJpy = disposalGainJpy.plus(incomeJpy);

  const closingQuantity = totalQuantity.minus(disposedQuantity);
  const closingCostJpy = averageUnitCostJpy.times(closingQuantity);

  return {
    symbol,
    openingQuantity,
    openingCostJpy,
    acquiredQuantity,
    acquiredCostJpy,
    averageUnitCostJpy,
    incomeJpy,
    disposedQuantity,
    proceedsJpy,
    costOfDisposedJpy,
    realizedGainJpy,
    closingQuantity,
    closingCostJpy,
  };
}

export interface CryptoPortfolioYearResult {
  bySymbol: CryptoSymbolYearResult[];
  /** 全銘柄合計の雑所得金額(暗号資産分) */
  totalRealizedGainJpy: Decimal;
}

/**
 * 複数銘柄が混在した取引一覧を銘柄別に集計し、全体の雑所得合計を計算する。
 */
export function calculateCryptoPortfolioYear(
  trades: (CryptoTradeInput & { symbol: string })[],
  openings?: Record<string, CryptoOpeningBalance>,
): CryptoPortfolioYearResult {
  const tradesBySymbol = new Map<string, CryptoTradeInput[]>();
  for (const trade of trades) {
    const list = tradesBySymbol.get(trade.symbol) ?? [];
    list.push(trade);
    tradesBySymbol.set(trade.symbol, list);
  }

  // 期首残高のみ存在し当年取引が無い銘柄も結果に含める
  if (openings) {
    for (const symbol of Object.keys(openings)) {
      if (!tradesBySymbol.has(symbol)) {
        tradesBySymbol.set(symbol, []);
      }
    }
  }

  const bySymbol = Array.from(tradesBySymbol.entries())
    .map(([symbol, symbolTrades]) =>
      calculateCryptoYear(symbol, symbolTrades, openings?.[symbol]),
    )
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  const totalRealizedGainJpy = bySymbol.reduce(
    (sum, result) => sum.plus(result.realizedGainJpy),
    new Decimal(0),
  );

  return { bySymbol, totalRealizedGainJpy };
}
