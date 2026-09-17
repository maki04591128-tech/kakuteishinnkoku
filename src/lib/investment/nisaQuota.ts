import { Decimal } from "decimal.js";

/**
 * NISA(少額投資非課税制度)の年間投資枠の使用状況集計。
 *
 * 2024年以降の新NISA制度では、年間投資枠が「つみたて投資枠(120万円)」と
 * 「成長投資枠(240万円)」の2種類に分かれ、それぞれ独立して上限を管理する
 * (両方を使い切っても生涯投資枠の範囲内であれば非課税)。本モジュールは
 * その年にアプリへ登録された NISA口座の買付(type=BUY)取引を集計し、
 * 各枠の年間上限に対する使用状況を試算する。
 *
 * 生涯投資枠(総枠1,800万円・うち成長投資枠1,200万円)は
 * calculateNisaLifetimeQuotaUsage で試算する。売却による枠の再利用
 * (簿価残高の翌年復活)やアプリ導入以前の取引は本ツールのデータだけでは
 * 正確に追えないため、年始時点で確定している使用額(前年末の保有簿価残高)を
 * `NisaLifetimeQuota`テーブルにユーザーが手入力(または前年分の計算結果から
 * 繰り越し)する前提とする。
 *
 * 簡略化している点:
 *  - 買付金額は約定代金(数量×単価)を用い、手数料は含めない
 *    (NISA口座の買付は無手数料の証券会社が大半のため)。
 */

export const NISA_TSUMITATE_ANNUAL_LIMIT_JPY = new Decimal(1_200_000);
export const NISA_GROWTH_ANNUAL_LIMIT_JPY = new Decimal(2_400_000);

/** 生涯非課税限度額(総枠)。つみたて投資枠・成長投資枠の合計で管理する。 */
export const NISA_LIFETIME_LIMIT_JPY = new Decimal(18_000_000);
/** 生涯非課税限度額のうち、成長投資枠に割り当てられる上限。 */
export const NISA_LIFETIME_GROWTH_LIMIT_JPY = new Decimal(12_000_000);

export type NisaQuotaType = "TSUMITATE" | "GROWTH";

export interface NisaQuotaTradeInput {
  type: "BUY" | "SELL" | "DIVIDEND";
  isNisa: boolean;
  /** isNisa=true かつ type=BUY の場合のみ意味を持つ */
  nisaType?: NisaQuotaType | null;
  quantity: Decimal.Value;
  unitPriceJpy: Decimal.Value;
}

export interface NisaQuotaUsageResult {
  tsumitateLimitJpy: Decimal;
  tsumitateUsedJpy: Decimal;
  tsumitateRemainingJpy: Decimal;
  growthLimitJpy: Decimal;
  growthUsedJpy: Decimal;
  growthRemainingJpy: Decimal;
  /** NISA口座の買付だが枠区分(nisaType)が未入力の取引の合計額。いずれの枠の使用額にも含めていない */
  unclassifiedBuyJpy: Decimal;
}

interface NisaBuyTotals {
  tsumitateJpy: Decimal;
  growthJpy: Decimal;
  unclassifiedJpy: Decimal;
}

/** その年にNISA口座で買付(type=BUY)された金額を、枠区分ごとに合計する。 */
function sumNisaBuyByType(trades: NisaQuotaTradeInput[]): NisaBuyTotals {
  let tsumitateJpy = new Decimal(0);
  let growthJpy = new Decimal(0);
  let unclassifiedJpy = new Decimal(0);

  for (const trade of trades) {
    if (!trade.isNisa || trade.type !== "BUY") continue;
    const amount = new Decimal(trade.quantity).times(trade.unitPriceJpy);

    if (trade.nisaType === "TSUMITATE") {
      tsumitateJpy = tsumitateJpy.plus(amount);
    } else if (trade.nisaType === "GROWTH") {
      growthJpy = growthJpy.plus(amount);
    } else {
      unclassifiedJpy = unclassifiedJpy.plus(amount);
    }
  }

  return { tsumitateJpy, growthJpy, unclassifiedJpy };
}

export function calculateNisaQuotaUsage(trades: NisaQuotaTradeInput[]): NisaQuotaUsageResult {
  const { tsumitateJpy: tsumitateUsedJpy, growthJpy: growthUsedJpy, unclassifiedJpy: unclassifiedBuyJpy } =
    sumNisaBuyByType(trades);

  return {
    tsumitateLimitJpy: NISA_TSUMITATE_ANNUAL_LIMIT_JPY,
    tsumitateUsedJpy,
    tsumitateRemainingJpy: NISA_TSUMITATE_ANNUAL_LIMIT_JPY.minus(tsumitateUsedJpy),
    growthLimitJpy: NISA_GROWTH_ANNUAL_LIMIT_JPY,
    growthUsedJpy,
    growthRemainingJpy: NISA_GROWTH_ANNUAL_LIMIT_JPY.minus(growthUsedJpy),
    unclassifiedBuyJpy,
  };
}

/** taxYearId の年始時点で確定している、枠区分ごとの生涯投資枠の使用額(前年末の保有簿価残高)。 */
export interface NisaLifetimeOpeningInput {
  nisaType: NisaQuotaType;
  /** 年始時点の非課税枠使用額(前年末時点の保有簿価残高) */
  openingUsedJpy: Decimal.Value;
  /** 当年中に売却した、この枠で買い付けた保有分の取得価額(簿価)の合計(手入力) */
  soldCostBasisJpy?: Decimal.Value;
}

export interface NisaLifetimeQuotaTypeResult {
  nisaType: NisaQuotaType;
  openingUsedJpy: Decimal;
  /** 当年の買付額(この枠区分分) */
  buyJpy: Decimal;
  soldCostBasisJpy: Decimal;
  /** 当年末時点の使用額。翌年の openingUsedJpy として繰り越す値。 */
  closingUsedJpy: Decimal;
}

export interface NisaLifetimeQuotaResult {
  byType: NisaLifetimeQuotaTypeResult[];
  lifetimeLimitJpy: Decimal;
  growthLifetimeLimitJpy: Decimal;
  totalOpeningUsedJpy: Decimal;
  totalBuyJpy: Decimal;
  totalClosingUsedJpy: Decimal;
  /** 年始時点で残っている生涯投資枠(総枠) */
  remainingAtYearStartJpy: Decimal;
  /** 年始時点で残っている成長投資枠(生涯上限1,200万円分) */
  growthRemainingAtYearStartJpy: Decimal;
  /** 当年の買付額(合計)が年始時点の残り生涯投資枠(総枠)を超えている場合、その超過額 */
  exceededOverallJpy: Decimal;
  /** 当年の成長投資枠の買付額が年始時点の残り成長投資枠(生涯上限)を超えている場合、その超過額 */
  exceededGrowthJpy: Decimal;
  /** NISA口座の買付だが枠区分(つみたて/成長)が未入力のため、この試算に含めていない金額 */
  unclassifiedBuyJpy: Decimal;
}

/**
 * NISA生涯投資枠(総枠1,800万円・うち成長投資枠1,200万円)の使用状況試算。
 *
 * 年間投資枠(calculateNisaQuotaUsage)はその年の買付だけで判定できるが、
 * 生涯投資枠は過去の買付・売却の累積(簿価残高)を追う必要がある。
 * 売却により再利用可能になった枠は売却した年の翌年から使えるようになるため、
 * openings(年始時点で確定している使用額)を起点に当年の買付額を加算するだけで
 * 「当年、あといくら買えるか」を判定でき、当年の売却額(手入力)は
 * 「翌年にどこまで枠が戻るか」の算出にのみ影響する。
 */
export function calculateNisaLifetimeQuotaUsage(
  trades: NisaQuotaTradeInput[],
  openings: NisaLifetimeOpeningInput[],
): NisaLifetimeQuotaResult {
  const buys = sumNisaBuyByType(trades);
  const openingByType = new Map(openings.map((o) => [o.nisaType, o]));

  function buildType(nisaType: NisaQuotaType, buyJpy: Decimal): NisaLifetimeQuotaTypeResult {
    const opening = openingByType.get(nisaType);
    const openingUsedJpy = new Decimal(opening?.openingUsedJpy ?? 0);
    const soldCostBasisJpy = new Decimal(opening?.soldCostBasisJpy ?? 0);
    return {
      nisaType,
      openingUsedJpy,
      buyJpy,
      soldCostBasisJpy,
      closingUsedJpy: openingUsedJpy.plus(buyJpy).minus(soldCostBasisJpy),
    };
  }

  const tsumitate = buildType("TSUMITATE", buys.tsumitateJpy);
  const growth = buildType("GROWTH", buys.growthJpy);

  const totalOpeningUsedJpy = tsumitate.openingUsedJpy.plus(growth.openingUsedJpy);
  const totalBuyJpy = tsumitate.buyJpy.plus(growth.buyJpy);
  const totalClosingUsedJpy = tsumitate.closingUsedJpy.plus(growth.closingUsedJpy);

  const remainingAtYearStartJpy = NISA_LIFETIME_LIMIT_JPY.minus(totalOpeningUsedJpy);
  const growthRemainingAtYearStartJpy = NISA_LIFETIME_GROWTH_LIMIT_JPY.minus(growth.openingUsedJpy);

  const exceededOverallJpy = totalBuyJpy.greaterThan(remainingAtYearStartJpy)
    ? totalBuyJpy.minus(remainingAtYearStartJpy)
    : new Decimal(0);
  const exceededGrowthJpy = growth.buyJpy.greaterThan(growthRemainingAtYearStartJpy)
    ? growth.buyJpy.minus(growthRemainingAtYearStartJpy)
    : new Decimal(0);

  return {
    byType: [tsumitate, growth],
    lifetimeLimitJpy: NISA_LIFETIME_LIMIT_JPY,
    growthLifetimeLimitJpy: NISA_LIFETIME_GROWTH_LIMIT_JPY,
    totalOpeningUsedJpy,
    totalBuyJpy,
    totalClosingUsedJpy,
    remainingAtYearStartJpy,
    growthRemainingAtYearStartJpy,
    exceededOverallJpy,
    exceededGrowthJpy,
    unclassifiedBuyJpy: buys.unclassifiedJpy,
  };
}

export interface NisaLifetimeCarryForwardCandidate {
  nisaType: NisaQuotaType;
  openingUsedJpy: string;
}

/**
 * ある年の生涯投資枠の計算結果(当年末の使用額)から、翌年の年始使用額候補を
 * 導出する。DBに依存しない純粋関数。使用額0(その枠を一度も使っていない)の
 * 区分は繰り越す意味がないため除外する。
 */
export function deriveNisaLifetimeCarryForwardCandidates(
  result: NisaLifetimeQuotaResult,
): NisaLifetimeCarryForwardCandidate[] {
  return result.byType
    .filter((t) => !t.closingUsedJpy.isZero())
    .map((t) => ({ nisaType: t.nisaType, openingUsedJpy: t.closingUsedJpy.toString() }));
}
