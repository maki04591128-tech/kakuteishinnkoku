import { Decimal } from "decimal.js";
import { SEPARATE_NATIONAL_TAX_RATE, SEPARATE_RESIDENT_TAX_RATE } from "../incomeTax";

/**
 * 国外転出(贈与)時課税制度(所得税法60条の3、国税庁タックスアンサーNo.1467
 * 「贈与により非居住者に資産が移転した場合の譲渡所得等の特例(国外転出(贈与)時課税)」)
 * の試算。
 *
 * 国外転出時課税制度(機能101・`exitTax.ts`。所得税法60条の2)は、贈与者自身が
 * 海外へ転出する場合の特例だったのに対し、こちらは贈与者が国内に居住したまま、
 * 対象資産の全部又は一部を国外に居住する者(非居住者)に贈与した場合の特例
 * (同じ平成27年度税制改正で新設された60条の2の姉妹規定)。贈与者が国内に住所を
 * 有する居住者のままであっても、贈与により対象資産の含み益に対する課税権を
 * 失うことを防ぐため、その贈与の時に贈与対象資産の譲渡があったものとみなして
 * 贈与者に譲渡所得等の課税を行う。
 *
 * 適用対象者の要件(次の両方を満たす場合のみ対象。No.1467):
 *  1. 贈与の時に贈与者が所有等している対象資産(株式・投資信託等の有価証券等)の
 *     価額等の合計額が1億円以上であること
 *     (この1億円判定は、贈与した部分だけでなく贈与者が保有する対象資産の
 *     "全体"の価額で行う点に注意。国外転出時課税(60条の2)と異なり、
 *     課税対象になるのは保有資産全体ではなく実際に贈与した部分のみ)
 *  2. 贈与の日前10年以内において、国内に住所又は居所を有していた期間の
 *     合計が5年を超えていること
 * (受贈者側に親族等の要件は無い(国税庁法令解釈通達60の2-1参照)。出国税と
 * 同様、外交官等の一定の在留資格による除外規定があるが本ツールでは判定しない。
 * 下記「制約」参照)
 *
 * 課税対象となる金額は、対象資産全体の含み益ではなく、実際に贈与した対象資産
 * (贈与対象資産)の含み益のみ。課税方法は国外転出時課税と同じ申告分離課税
 * (一律20.315%。所得税15.315%+住民税5%)で、上場株式等・一般株式等は
 * それぞれ別プールとして損益を合算し(措置法37条の10等と同じ整理。機能54参照)、
 * プール内が譲渡損失になった場合はその年のこの試算上0円として扱う。
 *
 * 制約(今後の課題):
 *  - 対象資産は株式・投資信託等の有価証券のみとし、匿名組合契約の出資持分・
 *    未決済の信用取引及び発行日取引・未決済のデリバティブ取引は対象外(本ツールは
 *    未決済ポジションの残高を管理していないため。国外転出時課税(機能101)と同じ
 *    整理)。
 *  - 除外規定(在留資格が「外交」等の一定の在留資格による在留期間の除外等)は
 *    判定しない。
 *  - 納税猶予制度(所得税法137条の3。担保提供・継続適用届出書の提出により
 *    贈与の日から5年(届出により最長10年)間納税を猶予できる)、その期間内に
 *    受贈者が帰国(または贈与者が国外転出)し対象資産を引き続き保有していた
 *    場合の課税取消し(同法60条の3第4項・153条の3)、納税猶予期間中に受贈者が
 *    実際に対象資産を譲渡した価額がこの試算の価額を下回った場合等の更正の請求
 *    による減額の特例は、いずれも金額計算の対象外とし、注記での案内にとどめる。
 *  - 相続又は遺贈により非居住者に資産が移転した場合の特例(国外転出(相続)時課税。
 *    国税庁タックスアンサーNo.1468。同じ60条の3の枠組みだが、被相続人の準確定
 *    申告で課税される点や相続人が複数いる場合の按分等、贈与のケースと申告主体・
 *    手続が異なる)は、本ツールが単一の確定申告書作成を前提としているため対象外
 *    (今後の課題)。
 *  - この試算で計算した含み益は、実際の申告では贈与を行った年のその他の株式等の
 *    譲渡損益(上場株式等の譲渡損失の繰越控除の使用分を含む)と合算して申告
 *    分離課税の課税所得を計算する必要があるが、本ツールは他の試算画面
 *    (国外転出時課税・一時所得・総合課税の譲渡所得等)と同様にDBへの登録・
 *    `/tax-estimate`への自動反映は行わない単体の試算画面とする(結果は手入力で
 *    反映すること)。
 */

export interface GiftExitTaxHoldingInput {
  symbol: string;
  /** 上場株式等(true)か一般株式等・非上場株式等(false)か。措置法37条の10等と同じ区分 */
  isListed: boolean;
  /**
   * その銘柄のうち、実際に非居住者へ贈与した部分かどうか。falseの場合は
   * 1億円判定(資産基準)の対象資産の価額には含めるが、課税対象(含み益の計算)には
   * 含めない(贈与者が贈与後も引き続き保有する部分、という位置付け)。
   */
  isGiftedAsset: boolean;
  /** 贈与の時点における保有数量(贈与した部分・していない部分いずれも、この時点の数量を入力) */
  quantity: Decimal.Value;
  /**
   * その保有数量に対応する取得費の合計額(単価ではなく総額)。isGiftedAssetがfalseの
   * 場合は課税対象の計算には使わないが、入力欄の一貫性のため0円等で入力してよい。
   */
  costBasisJpy: Decimal.Value;
  /** 贈与の時における1単位あたり時価 */
  valuationPriceJpy: Decimal.Value;
}

export interface GiftExitTaxInput {
  holdings: GiftExitTaxHoldingInput[];
  /** 贈与の日前10年以内に、国内に住所又は居所を有していた期間の合計(年) */
  domesticResidenceYearsInPast10Years: number;
}

export interface GiftExitTaxHoldingResult {
  symbol: string;
  isListed: boolean;
  isGiftedAsset: boolean;
  quantity: Decimal;
  costBasisJpy: Decimal;
  valuationPriceJpy: Decimal;
  /** 贈与時点の時価評価額(quantity × valuationPriceJpy) */
  marketValueJpy: Decimal;
  /** みなし譲渡益(marketValueJpy - costBasisJpy。マイナスの場合は含み損。贈与した部分のみ意味を持つ) */
  deemedGainJpy: Decimal;
}

export interface GiftExitTaxPoolResult {
  isListed: boolean;
  /** プール内(贈与した部分のみ)で合算したみなし譲渡損益(マイナスもありうる) */
  netGainJpy: Decimal;
  /** 課税対象額(netGainJpyが負の場合は0円に切り捨て) */
  taxableGainJpy: Decimal;
}

export interface GiftExitTaxResult {
  holdings: GiftExitTaxHoldingResult[];
  /** 贈与者が贈与の時に所有等している対象資産の価額の合計額(贈与した部分・していない部分の両方。1億円判定に使用) */
  totalHoldingsMarketValueJpy: Decimal;
  /** 資産基準(1億円以上)を満たすかどうか */
  meetsAssetThreshold: boolean;
  /** 居住期間要件(過去10年以内に5年超)を満たすかどうか */
  meetsResidencyRequirement: boolean;
  /** 両要件を満たし、国外転出(贈与)時課税の対象になるかどうか */
  isSubjectToGiftExitTax: boolean;
  listedPool: GiftExitTaxPoolResult;
  unlistedPool: GiftExitTaxPoolResult;
  /** 課税対象額の合計(上場+一般。それぞれ0円未満には切り下げない) */
  totalTaxableGainJpy: Decimal;
  nationalTaxJpy: Decimal;
  residentTaxJpy: Decimal;
  totalTaxJpy: Decimal;
  notes: string[];
}

const ASSET_THRESHOLD_JPY = new Decimal(100_000_000);
const RESIDENCY_YEARS_THRESHOLD = 5;

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

function emptyPool(isListed: boolean): GiftExitTaxPoolResult {
  return { isListed, netGainJpy: new Decimal(0), taxableGainJpy: new Decimal(0) };
}

export function estimateGiftExitTax(input: GiftExitTaxInput): GiftExitTaxResult {
  if (
    !Number.isFinite(input.domesticResidenceYearsInPast10Years) ||
    input.domesticResidenceYearsInPast10Years < 0
  ) {
    throw new Error("国内に住所又は居所を有していた期間(年)は0以上である必要があります");
  }

  const holdings: GiftExitTaxHoldingResult[] = input.holdings.map((h) => {
    const quantity = new Decimal(h.quantity);
    const costBasisJpy = new Decimal(h.costBasisJpy);
    const valuationPriceJpy = new Decimal(h.valuationPriceJpy);

    requireNonNegative(quantity, `保有数量(${h.symbol})`);
    requireNonNegative(costBasisJpy, `取得費(${h.symbol})`);
    requireNonNegative(valuationPriceJpy, `贈与時点の時価(${h.symbol})`);

    const marketValueJpy = quantity.times(valuationPriceJpy);
    const deemedGainJpy = marketValueJpy.minus(costBasisJpy);

    return {
      symbol: h.symbol,
      isListed: h.isListed,
      isGiftedAsset: h.isGiftedAsset,
      quantity,
      costBasisJpy,
      valuationPriceJpy,
      marketValueJpy,
      deemedGainJpy,
    };
  });

  const totalHoldingsMarketValueJpy = holdings.reduce(
    (sum, h) => sum.plus(h.marketValueJpy),
    new Decimal(0),
  );

  const meetsAssetThreshold = totalHoldingsMarketValueJpy.greaterThanOrEqualTo(ASSET_THRESHOLD_JPY);
  const meetsResidencyRequirement =
    input.domesticResidenceYearsInPast10Years > RESIDENCY_YEARS_THRESHOLD;
  const isSubjectToGiftExitTax = meetsAssetThreshold && meetsResidencyRequirement;

  const listedPool = emptyPool(true);
  const unlistedPool = emptyPool(false);
  if (isSubjectToGiftExitTax) {
    for (const h of holdings) {
      if (!h.isGiftedAsset) continue;
      const pool = h.isListed ? listedPool : unlistedPool;
      pool.netGainJpy = pool.netGainJpy.plus(h.deemedGainJpy);
    }
    listedPool.taxableGainJpy = Decimal.max(0, listedPool.netGainJpy);
    unlistedPool.taxableGainJpy = Decimal.max(0, unlistedPool.netGainJpy);
  }

  const totalTaxableGainJpy = listedPool.taxableGainJpy.plus(unlistedPool.taxableGainJpy);
  const nationalTaxJpy = totalTaxableGainJpy.times(SEPARATE_NATIONAL_TAX_RATE);
  const residentTaxJpy = totalTaxableGainJpy.times(SEPARATE_RESIDENT_TAX_RATE);
  const totalTaxJpy = nationalTaxJpy.plus(residentTaxJpy);

  const notes: string[] = [
    "国税庁タックスアンサーNo.1467「贈与により非居住者に資産が移転した場合の譲渡所得等の特例(国外転出(贈与)時課税)」(所得税法60条の3、平成27年度税制改正)による概算値。対象は株式・投資信託等の有価証券のみとし、匿名組合契約の出資持分・未決済の信用取引及び発行日取引・未決済のデリバティブ取引は本ツールが残高を管理していないため対象外。",
    "適用対象者の要件は「贈与の時に贈与者が所有等している対象資産の価額の合計額(贈与した部分・していない部分の両方)が1億円以上」かつ「贈与の日前10年以内に国内に住所又は居所を有していた期間の合計が5年超」の両方を満たす場合のみ(受贈者側に親族等の要件は無い。外交官等の除外規定は判定しない)。いずれか一方でも満たさない場合は課税対象外。",
    "1億円判定は保有する対象資産の全体で行うが、実際に課税対象となる含み益は贈与した部分(isGiftedAsset)のみ。国外転出時課税(機能101。保有資産全体が課税対象)との違いに注意。",
    "上場株式等・一般株式等はそれぞれ別プールとして贈与した部分の損益を合算し、プール内が譲渡損失になった場合はその年のこの試算上0円として扱う(他方のプールや他の所得、他の年の実際の譲渡損益とは通算しない)。",
    "納税猶予制度(所得税法137条の3。担保提供・継続適用届出書の提出により贈与の日から5年(届出により最長10年)間納税を猶予できる)、その期間内に受贈者が帰国(または贈与者が国外転出)し対象資産を引き続き保有していた場合の課税取消し(同法60条の3第4項・153条の3)、納税猶予期間中に実際の譲渡価額がこの試算の価額を下回った場合等の更正の請求による減額の特例は、いずれも金額計算の対象外(注記のみ)。実際に適用を検討する場合は税理士・税務署に確認すること。",
    "相続又は遺贈により非居住者に資産が移転した場合の特例(国外転出(相続)時課税。国税庁タックスアンサーNo.1468)は、被相続人の準確定申告で課税される等、贈与のケースと申告主体・手続が異なるため本ツールでは対象外(今後の課題)。",
    "この試算結果(totalTaxableGainJpy等)は、他の試算画面(国外転出時課税・一時所得・総合課税の譲渡所得等)と同様にDBへの登録機能を持たない単体の試算画面のため、実際の申告では贈与を行った年の他の株式等譲渡損益と合算のうえ手入力で反映すること。",
  ];

  return {
    holdings,
    totalHoldingsMarketValueJpy,
    meetsAssetThreshold,
    meetsResidencyRequirement,
    isSubjectToGiftExitTax,
    listedPool,
    unlistedPool,
    totalTaxableGainJpy,
    nationalTaxJpy,
    residentTaxJpy,
    totalTaxJpy,
    notes,
  };
}
