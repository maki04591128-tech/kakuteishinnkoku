import { Decimal } from "decimal.js";

/**
 * 暗号資産(仮想通貨)の年間損益計算。
 *
 * 国税庁「暗号資産に関する税務上の取扱いについて(FAQ)」に基づき、
 * 1単位あたりの取得価額は次のいずれかの方法で算出する。
 *  - 総平均法(AVERAGE): その年の期首残高+年間取得分を合算した加重平均単価を
 *    その年の全ての譲渡に適用する。税務署への届出が無い場合の法定算出方法。
 *  - 移動平均法(MOVING_AVERAGE): 取得の都度、それまでの保有数量・取得価額と
 *    合算して平均単価を更新し、譲渡時にはその時点の平均単価を取得費とする。
 *    税務署への届出により選択できる(届出書は「所得税の暗号資産の評価方法の
 *    届出書」)。取引の前後関係が結果に影響するため tradedAt が必須。
 */

export type CryptoTradeType =
  | "BUY"
  | "SELL"
  | "TRADE_IN"
  | "TRADE_OUT"
  | "INCOME"
  | "GIFT_IN"
  | "GIFT_OUT"
  | "FEE";

export type CryptoCostMethod = "AVERAGE" | "MOVING_AVERAGE";

export interface CryptoTradeInput {
  type: CryptoTradeType;
  /** 数量(必ず正の値) */
  quantity: Decimal.Value;
  /**
   * 日本円換算の単価。BUY/TRADE_IN/INCOMEは取得時時価、SELL/TRADE_OUT/FEEは譲渡・使用時時価、
   * GIFT_INは贈与又は遺贈の場合はその時の時価、相続人に対する死因贈与・相続・包括遺贈・特定
   * 遺贈の場合は被相続人が死亡時に選択していた評価方法により評価した金額(国税庁「暗号資産等
   * に関する税務上の取扱いについて(FAQ)」1-5参照)、GIFT_OUTは贈与・寄附又は遺贈をした時に
   * おけるその暗号資産の時価(同FAQ2-10「暗号資産を低額(無償)譲渡等した場合の取扱い」・1-4
   * 「暗号資産による寄附を行った場合」参照。相続人に対する死因贈与・包括遺贈・特定遺贈は
   * 対象外(相続税の課税対象でありGIFT_INの対象)。時価より著しく低い対価(時価の70%未満)
   * による低額譲渡は本ツールでは未対応で、通常のSELL/TRADE_OUTとして入力した対価の額のみが
   * 総収入金額になる点に注意)。
   */
  unitPriceJpy: Decimal.Value;
  /** 日本円換算の手数料(円建てで支払われた場合)。暗号資産建て手数料は type: "FEE" の別取引として渡す。 */
  feeJpy?: Decimal.Value;
  /** 取引日時。method: "MOVING_AVERAGE" を使う場合は取引の前後関係の判定に必須。 */
  tradedAt?: Date | string;
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
  /**
   * 総平均法の場合はその年の年間平均単価。移動平均法の場合は期末時点の平均単価。
   * いずれも保有・取得が無い場合は 0。
   */
  averageUnitCostJpy: Decimal;
  /**
   * マイニング・ステーキング・レンディング等、取得時点で収入計上すべき金額。
   * 贈与・相続等(GIFT_IN)による取得は、相続税・贈与税の課税対象となり所得税の
   * 収入金額には算入しないため含まない(取得価額として取得原価に加算するのみ)。
   */
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
  "GIFT_IN",
]);
const DISPOSE_TYPES: ReadonlySet<CryptoTradeType> = new Set([
  "SELL",
  "TRADE_OUT",
  "FEE",
  "GIFT_OUT",
]);

function toDecimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

/**
 * 取引種別に応じた保有数量の増減(取得は+、譲渡・使用は-)。
 * マネーフォワード資産残高突合(assetBalanceReconciliation.ts)で、期間内の
 * 取引から当年の数量変化だけを取り出すために使う。
 */
export function cryptoTradeQuantityDelta(
  type: CryptoTradeType,
  quantity: Decimal.Value,
): Decimal {
  const value = toDecimal(quantity);
  return ACQUIRE_TYPES.has(type) ? value : value.negated();
}

/**
 * 単一銘柄の1年分の取引から損益を計算する。
 *
 * method: "AVERAGE"(既定・総平均法)の場合、trades の順序は結果に影響しない
 * (年間合計でのみ決まるため)。method: "MOVING_AVERAGE"(移動平均法)の場合は
 * 取引の前後関係で平均単価が変化するため、各取引の tradedAt が必須になる。
 */
export function calculateCryptoYear(
  symbol: string,
  trades: CryptoTradeInput[],
  opening?: CryptoOpeningBalance,
  method: CryptoCostMethod = "AVERAGE",
): CryptoSymbolYearResult {
  if (method === "MOVING_AVERAGE") {
    return calculateCryptoYearMovingAverage(symbol, trades, opening);
  }
  return calculateCryptoYearAverage(symbol, trades, opening);
}

function calculateCryptoYearAverage(
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
      // GIFT_IN(贈与・相続等による取得)は取得価額としてプールするのみで、
      // 取得時点では雑所得の収入計上をしない(相続税・贈与税の課税対象のため)。
    } else if (DISPOSE_TYPES.has(trade.type)) {
      // GIFT_OUT(贈与・寄附・遺贈による無償譲渡)もSELL/TRADE_OUTと同じく
      // quantity×unitPriceJpy(=その時の時価)をそのまま総収入金額とする
      // (国税庁FAQ2-10。実際の対価の受取は無いが、みなし譲渡として課税される)。
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

function toSortableTime(value: Date | string | undefined, symbol: string): number {
  if (value === undefined) {
    throw new Error(
      `移動平均法を使う場合は取引ごとに tradedAt(取引日時)の指定が必須です (symbol=${symbol})`,
    );
  }
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(time)) {
    throw new Error(`tradedAt が不正な日付です (symbol=${symbol})`);
  }
  return time;
}

export function calculateCryptoYearMovingAverage(
  symbol: string,
  trades: CryptoTradeInput[],
  opening?: CryptoOpeningBalance,
): CryptoSymbolYearResult {
  const openingQuantity = opening ? toDecimal(opening.quantity) : new Decimal(0);
  const openingCostJpy = opening ? toDecimal(opening.costBasisJpy) : new Decimal(0);

  if (openingQuantity.isNegative() || openingCostJpy.isNegative()) {
    throw new Error("期首残高の数量・取得価額は0以上である必要があります");
  }

  // 移動平均法は取得・譲渡の前後関係で平均単価が変わるため、年内は取引日時の
  // 昇順で処理する(同時刻の取引はtradesの元の順序を保つ: Array#sortは安定ソート)。
  // 要素数が1以下だとArray#sortはcomparatorを呼ばないため、tradedAtの検証は
  // ソート前に別途行う。
  const sortKeys = trades.map((trade) => toSortableTime(trade.tradedAt, symbol));
  const sorted = trades
    .map((trade, index) => ({ trade, index }))
    .sort((a, b) => sortKeys[a.index] - sortKeys[b.index])
    .map(({ trade }) => trade);

  let quantity = openingQuantity;
  let costJpy = openingCostJpy;
  let acquiredQuantity = new Decimal(0);
  let acquiredCostJpy = new Decimal(0);
  let incomeJpy = new Decimal(0);
  let disposedQuantity = new Decimal(0);
  let proceedsJpy = new Decimal(0);
  let costOfDisposedJpy = new Decimal(0);

  for (const trade of sorted) {
    const tradeQuantity = toDecimal(trade.quantity);
    const unitPrice = toDecimal(trade.unitPriceJpy);
    const fee = trade.feeJpy !== undefined ? toDecimal(trade.feeJpy) : new Decimal(0);

    if (tradeQuantity.isNegative() || tradeQuantity.isZero()) {
      throw new Error(`数量は正の値である必要があります (symbol=${symbol})`);
    }
    if (unitPrice.isNegative() || fee.isNegative()) {
      throw new Error(`単価・手数料は0以上である必要があります (symbol=${symbol})`);
    }

    const grossValue = tradeQuantity.times(unitPrice);

    if (ACQUIRE_TYPES.has(trade.type)) {
      const cost = grossValue.plus(fee);
      quantity = quantity.plus(tradeQuantity);
      costJpy = costJpy.plus(cost);
      acquiredQuantity = acquiredQuantity.plus(tradeQuantity);
      acquiredCostJpy = acquiredCostJpy.plus(cost);
      if (trade.type === "INCOME") {
        incomeJpy = incomeJpy.plus(grossValue);
      }
    } else if (DISPOSE_TYPES.has(trade.type)) {
      if (tradeQuantity.greaterThan(quantity)) {
        throw new Error(
          `その時点の保有数量(${quantity.toString()})を超える数量(${tradeQuantity.toString()})が譲渡されています (symbol=${symbol})`,
        );
      }
      const averageUnitCost = quantity.isZero() ? new Decimal(0) : costJpy.dividedBy(quantity);
      const costOfDisposed = averageUnitCost.times(tradeQuantity);

      quantity = quantity.minus(tradeQuantity);
      costJpy = costJpy.minus(costOfDisposed);
      disposedQuantity = disposedQuantity.plus(tradeQuantity);
      proceedsJpy = proceedsJpy.plus(grossValue).minus(fee);
      costOfDisposedJpy = costOfDisposedJpy.plus(costOfDisposed);
    } else {
      throw new Error(`未対応の取引種別です: ${trade.type as string}`);
    }
  }

  const disposalGainJpy = proceedsJpy.minus(costOfDisposedJpy);
  const realizedGainJpy = disposalGainJpy.plus(incomeJpy);
  const averageUnitCostJpy = quantity.isZero() ? new Decimal(0) : costJpy.dividedBy(quantity);

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
    closingQuantity: quantity,
    closingCostJpy: costJpy,
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
  method: CryptoCostMethod = "AVERAGE",
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
      calculateCryptoYear(symbol, symbolTrades, openings?.[symbol], method),
    )
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  const totalRealizedGainJpy = bySymbol.reduce(
    (sum, result) => sum.plus(result.realizedGainJpy),
    new Decimal(0),
  );

  return { bySymbol, totalRealizedGainJpy };
}

export function calculateCryptoPortfolioYearMovingAverage(
  trades: (CryptoTradeInput & { symbol: string; tradedAt?: Date | string })[],
  openings?: Record<string, CryptoOpeningBalance>,
): CryptoPortfolioYearResult {
  return calculateCryptoPortfolioYear(trades, openings, "MOVING_AVERAGE");
}

/**
 * cryptoCostMethod に応じて総平均法/移動平均法のいずれかで計算する。
 * 移動平均法の場合は全取引に tradedAt が必要。
 */
export function calculateCryptoPortfolioYearByMethod(
  method: CryptoCostMethod,
  trades: (CryptoTradeInput & { symbol: string; tradedAt?: Date | string })[],
  openings?: Record<string, CryptoOpeningBalance>,
): CryptoPortfolioYearResult {
  return calculateCryptoPortfolioYear(trades, openings, method);
}
