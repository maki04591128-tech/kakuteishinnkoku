import { Decimal } from "decimal.js";

/**
 * 暗号資産・株式等の含み損益(未実現損益)シミュレーション。
 *
 * 年末までに売却(決済)した場合の損益をあらかじめ試算し、損出し
 * (含み損のある銘柄を年内に売却して当年の所得を圧縮する節税策)や
 * 利確のタイミングを検討する材料を提供する。あくまで試算であり、
 * 実際の売却時の約定単価・手数料は反映しない。
 *
 * 保有数量・取得価額の合計は`crypto/calculator.ts`・`investment/calculator.ts`が
 * 計算する期末時点の値(closingQuantity/closingCostJpy)をそのまま使う。
 * 現在価格(currentPriceJpy)は時価データを自動取得する仕組みを持たないため、
 * ユーザーの手入力を前提とする。
 *
 * 資産区分ごとに売却損の扱いが異なる点に注意:
 *  - CRYPTO(暗号資産の雑所得)は総合課税で、その年の暗号資産の雑所得内でしか
 *    損益通算できず、翌年以後への繰越控除もない。
 *  - INVESTMENT(株式等・課税口座)は申告分離課税で、その年の他の株式等の
 *    譲渡益・配当所得(申告分離課税)と損益通算でき、控除しきれない損失は
 *    3年間繰り越せる(`investment/lossCarryforward.ts`参照)。
 *  - INVESTMENT_NISA(NISA口座)は非課税のため、含み損を実現しても他の所得と
 *    損益通算できず、繰越控除の対象にもならない(節税効果がない)。
 */

export type UnrealizedAssetType = "CRYPTO" | "INVESTMENT" | "INVESTMENT_NISA";

export interface UnrealizedHoldingInput {
  assetType: UnrealizedAssetType;
  symbol: string;
  /** 期末時点の保有数量(closingQuantity) */
  quantity: Decimal.Value;
  /** 期末時点の取得価額の合計(単価ではなく総額。closingCostJpy) */
  costBasisJpy: Decimal.Value;
  /** ユーザーが入力する現在(想定売却時)の1単位あたり価格 */
  currentPriceJpy: Decimal.Value;
}

export interface UnrealizedHoldingResult {
  assetType: UnrealizedAssetType;
  symbol: string;
  quantity: Decimal;
  costBasisJpy: Decimal;
  averageUnitCostJpy: Decimal;
  currentPriceJpy: Decimal;
  marketValueJpy: Decimal;
  unrealizedGainJpy: Decimal;
  /** 含み損があり、かつ売却により当年以後の税負担軽減に使える(NISA口座は対象外) */
  isLossHarvestCandidate: boolean;
}

export function calculateUnrealizedGain(
  input: UnrealizedHoldingInput,
): UnrealizedHoldingResult {
  const quantity = new Decimal(input.quantity);
  const costBasisJpy = new Decimal(input.costBasisJpy);
  const currentPriceJpy = new Decimal(input.currentPriceJpy);

  if (quantity.isNegative()) {
    throw new Error(`保有数量は0以上である必要があります (symbol=${input.symbol})`);
  }
  if (currentPriceJpy.isNegative()) {
    throw new Error(`現在価格は0以上である必要があります (symbol=${input.symbol})`);
  }

  const averageUnitCostJpy = quantity.isZero()
    ? new Decimal(0)
    : costBasisJpy.dividedBy(quantity);
  const marketValueJpy = quantity.times(currentPriceJpy);
  const unrealizedGainJpy = marketValueJpy.minus(costBasisJpy);

  return {
    assetType: input.assetType,
    symbol: input.symbol,
    quantity,
    costBasisJpy,
    averageUnitCostJpy,
    currentPriceJpy,
    marketValueJpy,
    unrealizedGainJpy,
    isLossHarvestCandidate:
      input.assetType !== "INVESTMENT_NISA" && unrealizedGainJpy.isNegative(),
  };
}

export interface UnrealizedGainSummary {
  holdings: UnrealizedHoldingResult[];
  totalMarketValueJpy: Decimal;
  totalUnrealizedGainJpy: Decimal;
  totalByAssetType: Record<UnrealizedAssetType, Decimal>;
}

const ASSET_TYPES: UnrealizedAssetType[] = ["CRYPTO", "INVESTMENT", "INVESTMENT_NISA"];

/**
 * 複数銘柄の含み損益をまとめて計算する。DBに依存しない純粋関数。
 */
export function summarizeUnrealizedGains(
  inputs: UnrealizedHoldingInput[],
): UnrealizedGainSummary {
  const holdings = inputs.map(calculateUnrealizedGain);

  const totalMarketValueJpy = holdings.reduce(
    (sum, h) => sum.plus(h.marketValueJpy),
    new Decimal(0),
  );
  const totalUnrealizedGainJpy = holdings.reduce(
    (sum, h) => sum.plus(h.unrealizedGainJpy),
    new Decimal(0),
  );

  const totalByAssetType = Object.fromEntries(
    ASSET_TYPES.map((assetType) => [assetType, new Decimal(0)]),
  ) as Record<UnrealizedAssetType, Decimal>;
  for (const h of holdings) {
    totalByAssetType[h.assetType] = totalByAssetType[h.assetType].plus(h.unrealizedGainJpy);
  }

  return { holdings, totalMarketValueJpy, totalUnrealizedGainJpy, totalByAssetType };
}
