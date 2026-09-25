import { Decimal } from "decimal.js";
import { SEPARATE_NATIONAL_TAX_RATE, SEPARATE_RESIDENT_TAX_RATE } from "../incomeTax";

/**
 * 国外転出時課税制度(いわゆる「出国税」。所得税法60条の2、国税庁タックスアンサー
 * No.1478「国外転出をする場合の譲渡所得等の特例」)の試算。
 *
 * 国外転出(日本国内に住所及び居所を有しないこととなること)をする一定の居住者が、
 * 転出時点で「対象資産」(有価証券(株式・投資信託等)・匿名組合契約の出資の持分・
 * 未決済の信用取引及び発行日取引・未決済のデリバティブ取引)を保有している場合、
 * 実際には譲渡していなくてもその対象資産を時価で譲渡したものとみなし、生じた
 * 含み益に対して譲渡所得等の課税を行う制度(平成27年度税制改正)。本ツールが
 * 対象とする暗号資産・投資の利用者のうち、高額の上場株式等・一般株式等を保有する
 * まま海外移住する場合に関わる制度のため、対象資産をここでは株式・投資信託等の
 * 有価証券に限定する(匿名組合出資・未決済信用取引/デリバティブは本ツールに
 * 保有ポジションの残高という概念が無いため対象外。下記「制約」参照)。
 *
 * 適用対象者の要件(次の両方を満たす場合のみ対象。No.1478):
 *  1. 国外転出時に有する対象資産の価額の合計額が1億円以上であること
 *  2. 国外転出の日前10年以内において、国内に住所又は居所を有していた期間の
 *     合計が5年を超えていること
 * (このほか「出国前に一時的滞在をしていた外国人」等の除外規定があるが、
 * 本ツールでは判定しない。下記「制約」参照)
 *
 * 対象資産の価額の算定時点は次のいずれかによる:
 *  - 納税管理人の届出をして国外転出後に確定申告書を提出する場合: 国外転出の時
 *    における価額
 *  - 納税管理人の届出をせず国外転出前に確定申告書を提出する場合: 国外転出の
 *    予定日の3か月前の日における価額
 * 本ツールはどちらの算定時点を使うかをユーザー自身が選んだ前提で、その時点の
 * 単価(valuationPriceJpy)をそのまま入力する方式とし、自動判定は行わない。
 *
 * 課税方法は通常の株式等の譲渡所得と同じ申告分離課税(一律20.315%。所得税
 * 15.315%+住民税5%)。上場株式等・一般株式等はそれぞれ別プールとして損益を
 * 合算し(措置法37条の10等と同じ整理。機能54参照)、プール内が譲渡損失になった
 * 場合はその年のこの試算上0円として扱う(他方のプールや他の所得と通算しない)。
 *
 * 制約(今後の課題):
 *  - 対象資産は株式・投資信託等の有価証券のみとし、匿名組合契約の出資持分・
 *    未決済の信用取引及び発行日取引・未決済のデリバティブ取引は対象外(本ツールは
 *    未決済ポジションの残高を管理していないため)。
 *  - 除外規定(在留資格が「外交」等の一定の在留資格による在留期間の除外等)は
 *    判定しない。
 *  - 納税猶予制度(所得税法137条の2。担保提供・継続適用届出書の提出により
 *    最長10年間納税を猶予できる)、5年(納税猶予延長時は10年)以内に帰国し対象
 *    資産を引き続き保有していた場合の課税取消し(同法60条の2第6項・153条の2)、
 *    納税猶予期間中に実際の譲渡価額がこの試算の価額を下回った場合等の更正の
 *    請求による減額の特例(同法60条の2第7項)は、いずれも金額計算の対象外とし、
 *    注記での案内にとどめる。
 *  - この試算で計算した含み益は、実際の申告では国外転出年のその他の株式等の
 *    譲渡損益(上場株式等の譲渡損失の繰越控除の使用分を含む)と合算して申告
 *    分離課税の課税所得を計算する必要があるが、本ツールは他の試算画面
 *    (一時所得・総合課税の譲渡所得等)と同様にDBへの登録・`/tax-estimate`への
 *    自動反映は行わない単体の試算画面とする(結果は手入力で反映すること)。
 */

export interface ExitTaxHoldingInput {
  symbol: string;
  /** 上場株式等(true)か一般株式等・非上場株式等(false)か。措置法37条の10等と同じ区分 */
  isListed: boolean;
  /** 価額の判定日時点の保有数量 */
  quantity: Decimal.Value;
  /** その保有数量に対応する取得費の合計額(単価ではなく総額) */
  costBasisJpy: Decimal.Value;
  /** 価額の判定日(国外転出の時、または納税管理人の届出が無い場合は転出予定日の3か月前)時点の1単位あたり時価 */
  valuationPriceJpy: Decimal.Value;
}

export interface ExitTaxInput {
  holdings: ExitTaxHoldingInput[];
  /** 国外転出の日前10年以内に、国内に住所又は居所を有していた期間の合計(年) */
  domesticResidenceYearsInPast10Years: number;
}

export interface ExitTaxHoldingResult {
  symbol: string;
  isListed: boolean;
  quantity: Decimal;
  costBasisJpy: Decimal;
  valuationPriceJpy: Decimal;
  /** 判定日時点の時価評価額(quantity × valuationPriceJpy) */
  marketValueJpy: Decimal;
  /** みなし譲渡益(marketValueJpy - costBasisJpy。マイナスの場合は含み損) */
  deemedGainJpy: Decimal;
}

export interface ExitTaxPoolResult {
  isListed: boolean;
  /** プール内で合算したみなし譲渡損益(マイナスもありうる) */
  netGainJpy: Decimal;
  /** 課税対象額(netGainJpyが負の場合は0円に切り捨て) */
  taxableGainJpy: Decimal;
}

export interface ExitTaxResult {
  holdings: ExitTaxHoldingResult[];
  /** 対象資産の価額の合計額(1億円判定に使用) */
  totalMarketValueJpy: Decimal;
  /** 資産基準(1億円以上)を満たすかどうか */
  meetsAssetThreshold: boolean;
  /** 居住期間要件(過去10年以内に5年超)を満たすかどうか */
  meetsResidencyRequirement: boolean;
  /** 両要件を満たし、国外転出時課税の対象になるかどうか */
  isSubjectToExitTax: boolean;
  listedPool: ExitTaxPoolResult;
  unlistedPool: ExitTaxPoolResult;
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

function emptyPool(isListed: boolean): ExitTaxPoolResult {
  return { isListed, netGainJpy: new Decimal(0), taxableGainJpy: new Decimal(0) };
}

export function estimateExitTax(input: ExitTaxInput): ExitTaxResult {
  if (
    !Number.isFinite(input.domesticResidenceYearsInPast10Years) ||
    input.domesticResidenceYearsInPast10Years < 0
  ) {
    throw new Error("国内に住所又は居所を有していた期間(年)は0以上である必要があります");
  }

  const holdings: ExitTaxHoldingResult[] = input.holdings.map((h) => {
    const quantity = new Decimal(h.quantity);
    const costBasisJpy = new Decimal(h.costBasisJpy);
    const valuationPriceJpy = new Decimal(h.valuationPriceJpy);

    requireNonNegative(quantity, `保有数量(${h.symbol})`);
    requireNonNegative(costBasisJpy, `取得費(${h.symbol})`);
    requireNonNegative(valuationPriceJpy, `判定日時点の時価(${h.symbol})`);

    const marketValueJpy = quantity.times(valuationPriceJpy);
    const deemedGainJpy = marketValueJpy.minus(costBasisJpy);

    return {
      symbol: h.symbol,
      isListed: h.isListed,
      quantity,
      costBasisJpy,
      valuationPriceJpy,
      marketValueJpy,
      deemedGainJpy,
    };
  });

  const totalMarketValueJpy = holdings.reduce(
    (sum, h) => sum.plus(h.marketValueJpy),
    new Decimal(0),
  );

  const meetsAssetThreshold = totalMarketValueJpy.greaterThanOrEqualTo(ASSET_THRESHOLD_JPY);
  const meetsResidencyRequirement =
    input.domesticResidenceYearsInPast10Years > RESIDENCY_YEARS_THRESHOLD;
  const isSubjectToExitTax = meetsAssetThreshold && meetsResidencyRequirement;

  const listedPool = emptyPool(true);
  const unlistedPool = emptyPool(false);
  if (isSubjectToExitTax) {
    for (const h of holdings) {
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
    "国税庁タックスアンサーNo.1478「国外転出をする場合の譲渡所得等の特例」(所得税法60条の2、平成27年度税制改正)による概算値。対象は株式・投資信託等の有価証券のみとし、匿名組合契約の出資持分・未決済の信用取引及び発行日取引・未決済のデリバティブ取引は本ツールが残高を管理していないため対象外。",
    "適用対象者の要件は「対象資産の価額の合計額が1億円以上」かつ「国外転出の日前10年以内に国内に住所又は居所を有していた期間の合計が5年超」の両方を満たす場合のみ(在留資格が「外交」等の除外規定は判定しない)。いずれか一方でも満たさない場合は課税対象外。",
    "対象資産の価額は、納税管理人の届出をして国外転出後に確定申告書を提出する場合は「国外転出の時における価額」、届出をせず国外転出前に確定申告書を提出する場合は「国外転出の予定日から起算して3か月前の日における価額」による。本ツールはどちらの時点を使うかをユーザー自身の入力に委ね、自動判定はしない。",
    "上場株式等・一般株式等はそれぞれ別プールとして損益を合算し、プール内が譲渡損失になった場合はその年のこの試算上0円として扱う(他方のプールや他の所得、他の年の実際の譲渡損益とは通算しない)。",
    "納税猶予制度(所得税法137条の2。担保提供・継続適用届出書の提出により最長10年間納税を猶予できる)、5年(納税猶予延長時は10年)以内に帰国し対象資産を引き続き保有していた場合の課税の取消し(同法60条の2第6項・153条の2)、納税猶予期間中に実際の譲渡価額がこの試算の価額を下回った場合等の更正の請求による減額の特例(同法60条の2第7項)は、いずれも金額計算の対象外(注記のみ)。実際に適用を検討する場合は税理士・税務署に確認すること。",
    "この試算結果(totalTaxableGainJpy等)は、他の試算画面(一時所得・総合課税の譲渡所得等)と同様にDBへの登録機能を持たない単体の試算画面のため、実際の申告では国外転出年の他の株式等譲渡損益と合算のうえ手入力で反映すること。",
  ];

  return {
    holdings,
    totalMarketValueJpy,
    meetsAssetThreshold,
    meetsResidencyRequirement,
    isSubjectToExitTax,
    listedPool,
    unlistedPool,
    totalTaxableGainJpy,
    nationalTaxJpy,
    residentTaxJpy,
    totalTaxJpy,
    notes,
  };
}
