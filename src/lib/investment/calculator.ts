import { Decimal } from "decimal.js";

/**
 * 上場株式・投資信託等の年間譲渡損益計算。
 *
 * 所得税法施行令118条により、株式等の取得費は「総平均法に準ずる方法」
 * (実務上は移動平均法と呼ばれる)で計算する。すなわち買付の都度、
 * それまでの保有数量・取得価額と合算して平均単価を更新し、
 * 売却時にはその時点の平均単価を取得費として損益を計算する。
 *
 * NISA口座は非課税のため、同一銘柄であっても課税口座とは
 * 完全に別の口座・別ロットとして扱われる。従って本モジュールでは
 * isNisa の値ごとに取得価額プールを分離して計算する。
 *
 * 簡略化している点(今後の課題):
 *  - 同一銘柄を複数の証券会社・複数の特定口座で保有している場合、
 *    本来は口座ごとに取得費を計算すべきだが、本バージョンでは
 *    銘柄単位で合算して計算する。
 *  - 配当所得は申告分離課税/総合課税/申告不要のいずれを選択するかで
 *    税額計算が変わるが、本バージョンでは受取額の集計のみ行う。
 */

export type InvestmentTradeType = "BUY" | "SELL" | "DIVIDEND";

export interface InvestmentTradeInput {
  tradedAt: Date;
  type: InvestmentTradeType;
  quantity: Decimal.Value;
  unitPriceJpy: Decimal.Value;
  feeJpy?: Decimal.Value;
  /** true の場合、非課税(NISA)口座の取引として損益計算から除外する */
  isNisa?: boolean;
}

export interface InvestmentOpeningBalance {
  quantity: Decimal.Value;
  costBasisJpy: Decimal.Value;
}

interface PoolState {
  quantity: Decimal;
  costJpy: Decimal;
  buyQuantity: Decimal;
  buyCostJpy: Decimal;
  sellQuantity: Decimal;
  proceedsJpy: Decimal;
  costOfSoldJpy: Decimal;
}

function newPoolState(opening?: InvestmentOpeningBalance): PoolState {
  return {
    quantity: opening ? new Decimal(opening.quantity) : new Decimal(0),
    costJpy: opening ? new Decimal(opening.costBasisJpy) : new Decimal(0),
    buyQuantity: new Decimal(0),
    buyCostJpy: new Decimal(0),
    sellQuantity: new Decimal(0),
    proceedsJpy: new Decimal(0),
    costOfSoldJpy: new Decimal(0),
  };
}

function applyTrade(
  pool: PoolState,
  trade: InvestmentTradeInput,
  symbol: string,
): void {
  const quantity = new Decimal(trade.quantity);
  const unitPrice = new Decimal(trade.unitPriceJpy);
  const fee = trade.feeJpy !== undefined ? new Decimal(trade.feeJpy) : new Decimal(0);

  if (quantity.isNegative() || quantity.isZero()) {
    throw new Error(`数量は正の値である必要があります (symbol=${symbol})`);
  }
  if (unitPrice.isNegative() || fee.isNegative()) {
    throw new Error(`単価・手数料は0以上である必要があります (symbol=${symbol})`);
  }

  if (trade.type === "BUY") {
    const cost = quantity.times(unitPrice).plus(fee);
    pool.quantity = pool.quantity.plus(quantity);
    pool.costJpy = pool.costJpy.plus(cost);
    pool.buyQuantity = pool.buyQuantity.plus(quantity);
    pool.buyCostJpy = pool.buyCostJpy.plus(cost);
  } else if (trade.type === "SELL") {
    if (quantity.greaterThan(pool.quantity)) {
      throw new Error(
        `保有数量(${pool.quantity.toString()})を超える数量(${quantity.toString()})が売却されています (symbol=${symbol})`,
      );
    }
    const averageUnitCost = pool.quantity.isZero()
      ? new Decimal(0)
      : pool.costJpy.dividedBy(pool.quantity);
    const costOfSold = averageUnitCost.times(quantity);
    const proceeds = quantity.times(unitPrice).minus(fee);

    pool.quantity = pool.quantity.minus(quantity);
    pool.costJpy = pool.costJpy.minus(costOfSold);
    pool.sellQuantity = pool.sellQuantity.plus(quantity);
    pool.proceedsJpy = pool.proceedsJpy.plus(proceeds);
    pool.costOfSoldJpy = pool.costOfSoldJpy.plus(costOfSold);
  }
  // DIVIDEND はコストプールに影響しないため、呼び出し側で別集計する
}

export interface InvestmentSymbolYearResult {
  symbol: string;
  openingQuantity: Decimal;
  openingCostJpy: Decimal;
  buyQuantity: Decimal;
  buyCostJpy: Decimal;
  sellQuantity: Decimal;
  proceedsJpy: Decimal;
  costOfSoldJpy: Decimal;
  /** 譲渡所得(課税口座分。申告分離課税の対象) */
  realizedGainJpy: Decimal;
  /** 配当等の受取額(課税口座分) */
  dividendJpy: Decimal;
  closingQuantity: Decimal;
  closingCostJpy: Decimal;
  /** 参考情報: NISA口座分の譲渡損益(非課税のため申告不要・損益通算不可) */
  nisaRealizedGainJpy: Decimal;
  /** 参考情報: NISA口座分の配当等 */
  nisaDividendJpy: Decimal;
  /** 参考情報: NISA口座分の期末保有数量(翌年への繰越用) */
  nisaClosingQuantity: Decimal;
  /** 参考情報: NISA口座分の期末取得価額合計(翌年への繰越用) */
  nisaClosingCostJpy: Decimal;
}

export function calculateInvestmentYear(
  symbol: string,
  trades: InvestmentTradeInput[],
  opening?: InvestmentOpeningBalance,
  nisaOpening?: InvestmentOpeningBalance,
): InvestmentSymbolYearResult {
  const taxablePool = newPoolState(opening);
  const nisaPool = newPoolState(nisaOpening);
  let dividendJpy = new Decimal(0);
  let nisaDividendJpy = new Decimal(0);

  const sorted = [...trades].sort(
    (a, b) => a.tradedAt.getTime() - b.tradedAt.getTime(),
  );

  for (const trade of sorted) {
    if (trade.type === "DIVIDEND") {
      const amount = new Decimal(trade.quantity).times(trade.unitPriceJpy);
      if (trade.isNisa) {
        nisaDividendJpy = nisaDividendJpy.plus(amount);
      } else {
        dividendJpy = dividendJpy.plus(amount);
      }
      continue;
    }
    applyTrade(trade.isNisa ? nisaPool : taxablePool, trade, symbol);
  }

  const realizedGainJpy = taxablePool.proceedsJpy.minus(taxablePool.costOfSoldJpy);
  const nisaRealizedGainJpy = nisaPool.proceedsJpy.minus(nisaPool.costOfSoldJpy);

  return {
    symbol,
    openingQuantity: opening ? new Decimal(opening.quantity) : new Decimal(0),
    openingCostJpy: opening ? new Decimal(opening.costBasisJpy) : new Decimal(0),
    buyQuantity: taxablePool.buyQuantity,
    buyCostJpy: taxablePool.buyCostJpy,
    sellQuantity: taxablePool.sellQuantity,
    proceedsJpy: taxablePool.proceedsJpy,
    costOfSoldJpy: taxablePool.costOfSoldJpy,
    realizedGainJpy,
    dividendJpy,
    closingQuantity: taxablePool.quantity,
    closingCostJpy: taxablePool.costJpy,
    nisaRealizedGainJpy,
    nisaDividendJpy,
    nisaClosingQuantity: nisaPool.quantity,
    nisaClosingCostJpy: nisaPool.costJpy,
  };
}

export interface InvestmentPortfolioYearResult {
  bySymbol: InvestmentSymbolYearResult[];
  /** 課税口座合計の譲渡所得(申告分離課税の対象額。損失の場合は負値) */
  totalRealizedGainJpy: Decimal;
  totalDividendJpy: Decimal;
}

export function calculateInvestmentPortfolioYear(
  trades: (InvestmentTradeInput & { symbol: string })[],
  openings?: Record<string, InvestmentOpeningBalance>,
  nisaOpenings?: Record<string, InvestmentOpeningBalance>,
): InvestmentPortfolioYearResult {
  const tradesBySymbol = new Map<string, InvestmentTradeInput[]>();
  for (const trade of trades) {
    const list = tradesBySymbol.get(trade.symbol) ?? [];
    list.push(trade);
    tradesBySymbol.set(trade.symbol, list);
  }

  for (const symbol of [
    ...Object.keys(openings ?? {}),
    ...Object.keys(nisaOpenings ?? {}),
  ]) {
    if (!tradesBySymbol.has(symbol)) {
      tradesBySymbol.set(symbol, []);
    }
  }

  const bySymbol = Array.from(tradesBySymbol.entries())
    .map(([symbol, symbolTrades]) =>
      calculateInvestmentYear(
        symbol,
        symbolTrades,
        openings?.[symbol],
        nisaOpenings?.[symbol],
      ),
    )
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  const totalRealizedGainJpy = bySymbol.reduce(
    (sum, r) => sum.plus(r.realizedGainJpy),
    new Decimal(0),
  );
  const totalDividendJpy = bySymbol.reduce(
    (sum, r) => sum.plus(r.dividendJpy),
    new Decimal(0),
  );

  return { bySymbol, totalRealizedGainJpy, totalDividendJpy };
}
