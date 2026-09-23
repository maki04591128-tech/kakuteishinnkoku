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
 *    税額計算が変わるが、本バージョンでは受取額の集計のみ行う
 *    (総合課税時の配当控除率区分ごとの内訳は`dividendFullCreditJpy`等で
 *    集計し、`dividendTaxSimulation.ts`側で税額計算に使う)。
 */

export type InvestmentTradeType = "BUY" | "SELL" | "DIVIDEND";

export type InvestmentAssetType = "STOCK" | "ETF" | "MUTUAL_FUND" | "BOND" | "OTHER";

/**
 * 配当等の金額を、総合課税を選択した場合の配当控除の税率区分ごとに分類する。
 *
 *  - FULL: 上場株式等の普通配当(STOCK)・ETF(J-REIT型を除く)。通常の
 *    配当控除率(国税10%/5%・住民税2.8%/1.4%)の対象。
 *  - HALF: 株式投資信託(MUTUAL_FUND)の収益分配金。外貨建資産等の
 *    組入割合が50%以下であることを前提に、通常の半分の税率
 *    (国税5%/2.5%・住民税1.4%/0.7%)の対象として扱う簡略化
 *    (組入割合が50%を超える場合は本来さらに率が下がる。今後の課題)。
 *  - NONE: 公社債投資信託・REIT等(BOND・OTHER)、およびJ-REIT型ETF
 *    (isReit=true)。不動産投資法人は法人税が実質非課税で二重課税が
 *    生じないため、配当控除の対象外。
 */
export function dividendCreditCategory(
  assetType: InvestmentAssetType | undefined,
  isReit?: boolean,
): "FULL" | "HALF" | "NONE" {
  switch (assetType) {
    case "MUTUAL_FUND":
      return "HALF";
    case "BOND":
    case "OTHER":
      return "NONE";
    case "ETF":
      return isReit ? "NONE" : "FULL";
    case "STOCK":
    default:
      return "FULL";
  }
}

export interface InvestmentTradeInput {
  tradedAt: Date;
  type: InvestmentTradeType;
  quantity: Decimal.Value;
  unitPriceJpy: Decimal.Value;
  feeJpy?: Decimal.Value;
  /** true の場合、非課税(NISA)口座の取引として損益計算から除外する */
  isNisa?: boolean;
  /** 国外で発行された株式・投資信託等かどうか(外国税額控除の対象判定に使用) */
  isForeign?: boolean;
  /** type="DIVIDEND"の場合、現地で源泉徴収された外国所得税額(円換算) */
  foreignTaxWithheldJpy?: Decimal.Value;
  /**
   * 銘柄種別(配当控除の税率区分の判定に使用。type="DIVIDEND"の場合のみ参照)。
   * 省略時は上場株式等(STOCK、通常の配当控除率)として扱う。
   */
  assetType?: InvestmentAssetType;
  /**
   * J-REIT(不動産投資信託)かどうか(assetType="ETF"の場合のみ参照。
   * type="DIVIDEND"の場合のみ配当控除の税率区分判定に使用)。
   * true の場合、配当控除の対象外(NONE)として扱う。
   */
  isReit?: boolean;
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

interface SellResult {
  proceeds: Decimal;
  costOfSold: Decimal;
}

function applyTrade(
  pool: PoolState,
  trade: InvestmentTradeInput,
  symbol: string,
): SellResult | undefined {
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
    return undefined;
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
    return { proceeds, costOfSold };
  }
  // DIVIDEND はコストプールに影響しないため、呼び出し側で別集計する
  return undefined;
}

/**
 * 取引種別に応じた保有数量の増減(買付は+、売却は-、配当は数量に影響しないため0)。
 * マネーフォワード資産残高突合(assetBalanceReconciliation.ts)で、期間内の
 * 取引から当年の数量変化だけを取り出すために使う。
 */
export function investmentTradeQuantityDelta(
  type: InvestmentTradeType,
  quantity: Decimal.Value,
): Decimal {
  if (type === "BUY") return new Decimal(quantity);
  if (type === "SELL") return new Decimal(quantity).negated();
  return new Decimal(0);
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
  /** 配当等の受取額(課税口座分)のうち、配当控除が通常税率で使える分(上場株式等・ETF) */
  dividendFullCreditJpy: Decimal;
  /** 配当等の受取額(課税口座分)のうち、配当控除が半分の税率で使える分(株式投資信託等) */
  dividendHalfCreditJpy: Decimal;
  /** 配当等の受取額(課税口座分)のうち、配当控除の対象外の分(公社債投資信託・REIT等) */
  dividendNoCreditJpy: Decimal;
  /**
   * 配当等の受取額のうち、国外で発行された株式・投資信託等(isForeign=true)からの
   * 分(課税口座分のみ)。外国税額控除の国外所得金額の自動集計に使う。
   */
  foreignSourceDividendJpy: Decimal;
  /**
   * 国外源泉の配当等につき源泉徴収された外国所得税額の合計(課税口座分のみ)。
   * NISA口座分は日本国内で非課税のため外国税額控除の対象外(集計しない)。
   */
  foreignTaxWithheldJpy: Decimal;
  /**
   * 譲渡所得(realizedGainJpy)のうち、国外で発行された株式・投資信託等
   * (isForeign=true)の売却による分(課税口座分のみ)。売却時の円換算額を
   * そのまま使うため為替差損益も含む。外国税額控除の国外所得金額の
   * 自動集計に使う(配当等と合算してforeignSourceIncomeJpyとする)。
   */
  foreignSourceCapitalGainJpy: Decimal;
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
  let dividendFullCreditJpy = new Decimal(0);
  let dividendHalfCreditJpy = new Decimal(0);
  let dividendNoCreditJpy = new Decimal(0);
  let nisaDividendJpy = new Decimal(0);
  let foreignSourceDividendJpy = new Decimal(0);
  let foreignTaxWithheldJpy = new Decimal(0);
  let foreignSourceCapitalGainJpy = new Decimal(0);

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
        switch (dividendCreditCategory(trade.assetType, trade.isReit)) {
          case "FULL":
            dividendFullCreditJpy = dividendFullCreditJpy.plus(amount);
            break;
          case "HALF":
            dividendHalfCreditJpy = dividendHalfCreditJpy.plus(amount);
            break;
          case "NONE":
            dividendNoCreditJpy = dividendNoCreditJpy.plus(amount);
            break;
        }
        // NISA口座分は国内非課税のため外国税額控除の対象外(集計は課税口座分のみ)
        if (trade.isForeign) {
          foreignSourceDividendJpy = foreignSourceDividendJpy.plus(amount);
          foreignTaxWithheldJpy = foreignTaxWithheldJpy.plus(
            new Decimal(trade.foreignTaxWithheldJpy ?? 0),
          );
        }
      }
      continue;
    }
    const sellResult = applyTrade(trade.isNisa ? nisaPool : taxablePool, trade, symbol);
    // NISA口座分は国内非課税のため外国税額控除の対象外(集計は課税口座分のみ)
    if (sellResult && trade.isForeign && !trade.isNisa) {
      foreignSourceCapitalGainJpy = foreignSourceCapitalGainJpy.plus(
        sellResult.proceeds.minus(sellResult.costOfSold),
      );
    }
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
    dividendFullCreditJpy,
    dividendHalfCreditJpy,
    dividendNoCreditJpy,
    foreignSourceDividendJpy,
    foreignTaxWithheldJpy,
    foreignSourceCapitalGainJpy,
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
  /** 課税口座合計の配当等のうち、配当控除が通常税率で使える分(上場株式等・ETF) */
  totalDividendFullCreditJpy: Decimal;
  /** 課税口座合計の配当等のうち、配当控除が半分の税率で使える分(株式投資信託等) */
  totalDividendHalfCreditJpy: Decimal;
  /** 課税口座合計の配当等のうち、配当控除の対象外の分(公社債投資信託・REIT等) */
  totalDividendNoCreditJpy: Decimal;
  /** 課税口座合計の国外源泉配当等の受取額(外国税額控除の国外所得金額の自動集計に使用) */
  totalForeignSourceDividendJpy: Decimal;
  /** 課税口座合計の外国所得税額(外国税額控除の外国所得税額の自動集計に使用) */
  totalForeignTaxWithheldJpy: Decimal;
  /**
   * 課税口座合計の国外源泉株式等の譲渡益(外国税額控除の国外所得金額の
   * 自動集計に使用。為替差損益を含む)。
   */
  totalForeignSourceCapitalGainJpy: Decimal;
  /**
   * 外国税額控除の国外所得金額の自動集計値
   * (totalForeignSourceDividendJpy + totalForeignSourceCapitalGainJpy)。
   */
  totalForeignSourceIncomeJpy: Decimal;
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
  const totalDividendFullCreditJpy = bySymbol.reduce(
    (sum, r) => sum.plus(r.dividendFullCreditJpy),
    new Decimal(0),
  );
  const totalDividendHalfCreditJpy = bySymbol.reduce(
    (sum, r) => sum.plus(r.dividendHalfCreditJpy),
    new Decimal(0),
  );
  const totalDividendNoCreditJpy = bySymbol.reduce(
    (sum, r) => sum.plus(r.dividendNoCreditJpy),
    new Decimal(0),
  );
  const totalForeignSourceDividendJpy = bySymbol.reduce(
    (sum, r) => sum.plus(r.foreignSourceDividendJpy),
    new Decimal(0),
  );
  const totalForeignTaxWithheldJpy = bySymbol.reduce(
    (sum, r) => sum.plus(r.foreignTaxWithheldJpy),
    new Decimal(0),
  );
  const totalForeignSourceCapitalGainJpy = bySymbol.reduce(
    (sum, r) => sum.plus(r.foreignSourceCapitalGainJpy),
    new Decimal(0),
  );
  const totalForeignSourceIncomeJpy = totalForeignSourceDividendJpy.plus(
    totalForeignSourceCapitalGainJpy,
  );

  return {
    bySymbol,
    totalRealizedGainJpy,
    totalDividendJpy,
    totalDividendFullCreditJpy,
    totalDividendHalfCreditJpy,
    totalDividendNoCreditJpy,
    totalForeignSourceDividendJpy,
    totalForeignTaxWithheldJpy,
    totalForeignSourceCapitalGainJpy,
    totalForeignSourceIncomeJpy,
  };
}
