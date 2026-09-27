import { Decimal } from "decimal.js";
import { SEPARATE_NATIONAL_TAX_RATE, SEPARATE_RESIDENT_TAX_RATE } from "../incomeTax";

/**
 * 国外転出(相続)時課税制度(所得税法60条の3第2項、国税庁タックスアンサー
 * No.1468「相続又は遺贈により非居住者に資産が移転した場合の譲渡所得等の特例
 * (国外転出(相続)時課税)」)の試算。
 *
 * 国外転出(贈与)時課税制度(機能106・`giftExitTax.ts`。所得税法60条の3第3項)は、
 * 贈与者が国内に居住したまま対象資産を非居住者に贈与した場合の特例だったのに
 * 対し、こちらは同じ60条の3が定める姉妹規定で、被相続人(相続開始時に国内に
 * 居住していた者)が死亡し、相続又は遺贈(限定承認に係るものを除く)により
 * 対象資産の全部又は一部を非居住者である相続人・受遺者が取得した場合に、その
 * 相続開始の時に対象資産の譲渡があったものとみなして被相続人に譲渡所得等の
 * 課税を行う。
 *
 * 適用対象者の要件(次の両方を満たす場合のみ対象。No.1468):
 *  1. 相続開始の時に被相続人が有していた対象資産(株式・投資信託等の有価証券等)の
 *     価額等の合計額が1億円以上であること
 *     (この1億円判定は、非居住者が取得した部分だけでなく被相続人が有していた
 *     対象資産の"全体"の価額で行う点に注意。実際に課税対象になるのは非居住者が
 *     取得した部分の含み益のみ。国外転出(贈与)時課税(機能106)と同じ整理)
 *  2. 被相続人が、相続開始の日前10年以内において、国内に住所又は居所を有して
 *     いた期間の合計が5年を超えていること
 * (相続人・受遺者側に親族等の要件は無い。外交官等の一定の在留資格による除外
 * 規定があるが本ツールでは判定しない。限定承認に係る相続は法令上そもそも本
 * 制度の対象外だが、限定承認に該当するかどうかの判定自体はユーザー自身の
 * 確認事項とする。下記「制約」参照)
 *
 * 課税対象となる金額は、対象資産全体の含み益ではなく、実際に非居住者が取得した
 * 対象資産(非居住者承継資産)の含み益のみ。課税方法は国外転出(贈与)時課税と
 * 同じ申告分離課税(一律20.315%。所得税15.315%+住民税5%)で、上場株式等・
 * 一般株式等はそれぞれ別プールとして損益を合算し(措置法37条の10等と同じ
 * 整理。機能54参照)、プール内が譲渡損失になった場合はその年のこの試算上0円
 * として扱う。
 *
 * この課税は被相続人に対するものであり、被相続人の死亡日までの所得として、
 * 相続人が被相続人に代わって提出する準確定申告(所得税法124条・125条。
 * 相続の開始があったことを知った日の翌日から4か月以内)で申告する必要がある
 * (相続人が2人以上いる場合は原則として全員が連署して提出する)。本ツールは
 * 単一の確定申告書作成を前提としているが、この試算自体は被相続人1人分の
 * 譲渡所得等の金額の計算であり、通常の確定申告と計算方法自体に違いは無いため、
 * 準確定申告固有の手続(提出期限・連署等)は注記での案内にとどめて対応する。
 *
 * 制約(今後の課題):
 *  - 対象資産は株式・投資信託等の有価証券のみとし、匿名組合契約の出資持分・
 *    未決済の信用取引及び発行日取引・未決済のデリバティブ取引は対象外(本ツールは
 *    未決済ポジションの残高を管理していないため。国外転出時課税(機能101)と同じ
 *    整理)。
 *  - 限定承認に係る相続(法令上もそもそも本制度の対象外)に該当するかどうかの
 *    判定、除外規定(在留資格が「外交」等の一定の在留資格による在留期間の除外等)
 *    は判定しない。
 *  - 準確定申告に固有の手続(相続人が2人以上いる場合の連署、提出期限である
 *    相続の開始があったことを知った日の翌日から4か月以内という期限管理)は
 *    対応しない。
 *  - 納税猶予制度(所得税法137条の3。相続人が担保提供・継続適用届出書の提出を
 *    行うことにより相続開始の日から5年(届出により最長10年)間納税を猶予できる)、
 *    その期間内に非居住者である相続人・受遺者が帰国し対象資産を引き続き保有して
 *    いた場合の課税取消し(同法60条の3第4項・153条の3)、納税猶予期間中に実際の
 *    譲渡価額がこの試算の価額を下回った場合等の更正の請求による減額の特例は、
 *    いずれも金額計算の対象外とし、注記での案内にとどめる。
 *  - この試算で計算した含み益は、実際の申告では相続開始年の被相続人のその他の
 *    株式等の譲渡損益(上場株式等の譲渡損失の繰越控除の使用分を含む)と合算して
 *    申告分離課税の課税所得を計算する必要があるが、本ツールは他の試算画面
 *    (国外転出時課税・国外転出(贈与)時課税・一時所得等)と同様にDBへの登録・
 *    `/tax-estimate`への自動反映は行わない単体の試算画面とする(結果は手入力で
 *    反映すること)。
 */

export interface InheritanceExitTaxHoldingInput {
  symbol: string;
  /** 上場株式等(true)か一般株式等・非上場株式等(false)か。措置法37条の10等と同じ区分 */
  isListed: boolean;
  /**
   * その銘柄のうち、実際に非居住者である相続人・受遺者が取得した部分かどうか。
   * falseの場合は1億円判定(資産基準)の対象資産の価額には含めるが、課税対象
   * (含み益の計算)には含めない(居住者である相続人・受遺者が取得した部分、
   * という位置付け)。
   */
  isInheritedByNonResident: boolean;
  /** 相続開始の時点における被相続人の保有数量(非居住者が取得した部分・していない部分いずれも、この時点の数量を入力) */
  quantity: Decimal.Value;
  /**
   * その保有数量に対応する取得費の合計額(単価ではなく総額)。
   * isInheritedByNonResidentがfalseの場合は課税対象の計算には使わないが、
   * 入力欄の一貫性のため0円等で入力してよい。
   */
  costBasisJpy: Decimal.Value;
  /** 相続開始の時における1単位あたり時価 */
  valuationPriceJpy: Decimal.Value;
}

export interface InheritanceExitTaxInput {
  holdings: InheritanceExitTaxHoldingInput[];
  /** 被相続人が、相続開始の日前10年以内に、国内に住所又は居所を有していた期間の合計(年) */
  domesticResidenceYearsInPast10Years: number;
}

export interface InheritanceExitTaxHoldingResult {
  symbol: string;
  isListed: boolean;
  isInheritedByNonResident: boolean;
  quantity: Decimal;
  costBasisJpy: Decimal;
  valuationPriceJpy: Decimal;
  /** 相続開始時点の時価評価額(quantity × valuationPriceJpy) */
  marketValueJpy: Decimal;
  /** みなし譲渡益(marketValueJpy - costBasisJpy。マイナスの場合は含み損。非居住者が取得した部分のみ意味を持つ) */
  deemedGainJpy: Decimal;
}

export interface InheritanceExitTaxPoolResult {
  isListed: boolean;
  /** プール内(非居住者が取得した部分のみ)で合算したみなし譲渡損益(マイナスもありうる) */
  netGainJpy: Decimal;
  /** 課税対象額(netGainJpyが負の場合は0円に切り捨て) */
  taxableGainJpy: Decimal;
}

export interface InheritanceExitTaxResult {
  holdings: InheritanceExitTaxHoldingResult[];
  /** 相続開始の時に被相続人が有していた対象資産の価額の合計額(非居住者が取得した部分・していない部分の両方。1億円判定に使用) */
  totalHoldingsMarketValueJpy: Decimal;
  /** 資産基準(1億円以上)を満たすかどうか */
  meetsAssetThreshold: boolean;
  /** 居住期間要件(過去10年以内に5年超)を満たすかどうか */
  meetsResidencyRequirement: boolean;
  /** 両要件を満たし、国外転出(相続)時課税の対象になるかどうか */
  isSubjectToInheritanceExitTax: boolean;
  listedPool: InheritanceExitTaxPoolResult;
  unlistedPool: InheritanceExitTaxPoolResult;
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

function emptyPool(isListed: boolean): InheritanceExitTaxPoolResult {
  return { isListed, netGainJpy: new Decimal(0), taxableGainJpy: new Decimal(0) };
}

export function estimateInheritanceExitTax(
  input: InheritanceExitTaxInput,
): InheritanceExitTaxResult {
  if (
    !Number.isFinite(input.domesticResidenceYearsInPast10Years) ||
    input.domesticResidenceYearsInPast10Years < 0
  ) {
    throw new Error("国内に住所又は居所を有していた期間(年)は0以上である必要があります");
  }

  const holdings: InheritanceExitTaxHoldingResult[] = input.holdings.map((h) => {
    const quantity = new Decimal(h.quantity);
    const costBasisJpy = new Decimal(h.costBasisJpy);
    const valuationPriceJpy = new Decimal(h.valuationPriceJpy);

    requireNonNegative(quantity, `保有数量(${h.symbol})`);
    requireNonNegative(costBasisJpy, `取得費(${h.symbol})`);
    requireNonNegative(valuationPriceJpy, `相続開始時点の時価(${h.symbol})`);

    const marketValueJpy = quantity.times(valuationPriceJpy);
    const deemedGainJpy = marketValueJpy.minus(costBasisJpy);

    return {
      symbol: h.symbol,
      isListed: h.isListed,
      isInheritedByNonResident: h.isInheritedByNonResident,
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
  const isSubjectToInheritanceExitTax = meetsAssetThreshold && meetsResidencyRequirement;

  const listedPool = emptyPool(true);
  const unlistedPool = emptyPool(false);
  if (isSubjectToInheritanceExitTax) {
    for (const h of holdings) {
      if (!h.isInheritedByNonResident) continue;
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
    "国税庁タックスアンサーNo.1468「相続又は遺贈により非居住者に資産が移転した場合の譲渡所得等の特例(国外転出(相続)時課税)」(所得税法60条の3第2項、平成27年度税制改正)による概算値。対象は株式・投資信託等の有価証券のみとし、匿名組合契約の出資持分・未決済の信用取引及び発行日取引・未決済のデリバティブ取引は本ツールが残高を管理していないため対象外。",
    "適用対象者の要件は「相続開始の時に被相続人が有していた対象資産の価額の合計額(非居住者が取得した部分・していない部分の両方)が1億円以上」かつ「被相続人が相続開始の日前10年以内に国内に住所又は居所を有していた期間の合計が5年超」の両方を満たす場合のみ(相続人・受遺者側に親族等の要件は無い。外交官等の除外規定・限定承認に係る相続かどうかは判定しない)。いずれか一方でも満たさない場合は課税対象外。",
    "1億円判定は被相続人が有していた対象資産の全体で行うが、実際に課税対象となる含み益は非居住者である相続人・受遺者が取得した部分(isInheritedByNonResident)のみ。国外転出時課税(機能101。保有資産全体が課税対象)との違いに注意。",
    "上場株式等・一般株式等はそれぞれ別プールとして非居住者が取得した部分の損益を合算し、プール内が譲渡損失になった場合はその年のこの試算上0円として扱う(他方のプールや他の所得、他の年の実際の譲渡損益とは通算しない)。",
    "この課税は被相続人に対するもので、被相続人の死亡日までの所得として相続人が代わって提出する準確定申告(所得税法124条・125条。相続の開始があったことを知った日の翌日から4か月以内。相続人が2人以上の場合は原則連署)で申告する。申告手続自体の期限管理・連署は本ツールの対象外だが、譲渡所得等の金額の計算方法自体は通常の確定申告と同じ。",
    "納税猶予制度(所得税法137条の3。相続人が担保提供・継続適用届出書の提出により相続開始の日から5年(届出により最長10年)間納税を猶予できる)、その期間内に非居住者である相続人・受遺者が帰国し対象資産を引き続き保有していた場合の課税取消し(同法60条の3第4項・153条の3)、納税猶予期間中に実際の譲渡価額がこの試算の価額を下回った場合等の更正の請求による減額の特例は、いずれも金額計算の対象外(注記のみ)。実際に適用を検討する場合は税理士・税務署に確認すること。",
    "この試算結果(totalTaxableGainJpy等)は、他の試算画面(国外転出時課税・国外転出(贈与)時課税・一時所得等)と同様にDBへの登録機能を持たない単体の試算画面のため、実際の申告では相続開始年の被相続人の他の株式等譲渡損益と合算のうえ手入力で反映すること。",
  ];

  return {
    holdings,
    totalHoldingsMarketValueJpy,
    meetsAssetThreshold,
    meetsResidencyRequirement,
    isSubjectToInheritanceExitTax,
    listedPool,
    unlistedPool,
    totalTaxableGainJpy,
    nationalTaxJpy,
    residentTaxJpy,
    totalTaxJpy,
    notes,
  };
}
