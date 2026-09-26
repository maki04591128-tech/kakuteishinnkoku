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
 *    最長10年間納税を猶予できる)そのものの手続き(担保提供・届出書の提出)は
 *    対応しない。5年(納税猶予延長時は10年)以内に帰国し対象資産を引き続き
 *    保有していた場合の課税取消し(同法60条の2第6項)は`estimateExitTaxCancellation`
 *    で試算する(下記参照)。納税猶予期間中に実際の譲渡価額がこの試算の価額を
 *    下回った場合等の更正の請求による減額の特例(同法60条の2第7項・第8項)は
 *    引き続き金額計算の対象外とし、注記での案内にとどめる。
 *
 * 帰国等による課税取消し(所得税法60条の2第6項第1号、国税庁タックスアンサー
 * No.1478)については`estimateExitTaxCancellation`を参照。国外転出の日から5年
 * (納税猶予の適用を受けている場合は10年)を経過する日までに帰国(国内に住所を
 * 有し、又は現在まで引き続いて1年以上居所を有することとなること)をした場合、
 * その帰国の時まで引き続き有している対象資産に限り、更正の請求によりその
 * 課税を取り消すことができる(帰国の時点で既に譲渡・使用済みの対象資産は
 * 取消しの対象にならない)。更正の請求の期限は帰国の日から4か月以内。
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

/**
 * 国外転出時課税の帰国等による課税取消し(所得税法60条の2第6項第1号、国税庁
 * タックスアンサーNo.1478)の試算。
 *
 * 国外転出の日から5年(納税猶予制度(同法137条の2)の適用を受けている場合は
 * 10年)を経過する日までに帰国(国内に住所を有し、又は現在まで引き続いて1年
 * 以上居所を有することとなること)をした場合において、帰国の時まで引き続き
 * 有している対象資産については、更正の請求により当初の国外転出時課税を
 * 取り消すことができる(帰国前に譲渡・使用等をして手放した対象資産は取消しの
 * 対象にならず、当初どおり課税される)。更正の請求の期限は帰国の日から4か月
 * 以内。
 *
 * 銘柄ごとの入力は`estimateExitTax`と同じ(区分・保有数量・取得費・判定日
 * 時点の時価)に、帰国の時まで引き続き保有していたかどうかを追加したもの。
 * 帰国要件を満たす場合、引き続き保有していた銘柄を除いた残りの銘柄のみで
 * `estimateExitTax`を再計算し(上場株式等・一般株式等それぞれ0円未満に
 * 切り下げるプール処理は当初試算と同じ)、当初の税額との差額を還付され得る
 * 税額として示す。
 *
 * 制約(今後の課題):
 *  - 保有数量の一部のみを帰国時まで保有していた場合(一部譲渡)は、その銘柄を
 *    「引き続き保有」「保有していない」のいずれか一方でしか扱えない(保有数量を
 *    分割した部分取消しには対応しない)。部分取消しを試算したい場合は、その
 *    銘柄を保有継続分・譲渡済み分の2行に分けて入力すること。
 *  - 納税猶予期間中に実際の譲渡価額がこの試算の価額を下回った場合等の更正の
 *    請求による減額の特例(同法60条の2第7項・第8項)は対象外(注記のみ)。
 *  - 還付され得る税額がマイナスになる場合(引き続き保有していた銘柄が含み損で
 *    あり、除外すると他方のプールとの通算前の含み損失分が減って課税対象額が
 *    かえって増える場合)は、更正の請求をすると不利になるため通常は請求しない
 *    運用上の判断はユーザーに委ね、本ツールでは自動判定しない(注記で案内)。
 */

export interface ExitTaxCancellationHoldingInput extends ExitTaxHoldingInput {
  /** 帰国の時まで引き続き有していたかどうか(所得税法60条の2第6項第1号) */
  stillHeldAtReturn: boolean;
}

export interface ExitTaxCancellationInput {
  holdings: ExitTaxCancellationHoldingInput[];
  /** 国外転出の日前10年以内に、国内に住所又は居所を有していた期間の合計(年)。当初の国外転出時課税の対象判定に使用 */
  domesticResidenceYearsInPast10Years: number;
  /** 国外転出の日(YYYY-MM-DD) */
  exitDate: string;
  /** 帰国の日(国内に住所を有し、又は現在まで引き続いて1年以上居所を有することとなった日。YYYY-MM-DD) */
  returnDate: string;
  /** 納税猶予制度(所得税法137条の2)の適用を受け、帰国期限が5年から10年に延長されているか */
  hasTaxDeferralExtension: boolean;
}

export interface ExitTaxCancellationResult {
  /** 帰国期限(5年、納税猶予延長時は10年)以内の帰国かどうか */
  meetsReturnDeadline: boolean;
  /** 判定に用いた帰国期限の年数(5または10) */
  deadlineYears: number;
  /** 更正の請求の期限(帰国の日から4か月を経過する日。YYYY-MM-DD) */
  amendedReturnDeadlineDate: string;
  /** 当初、国外転出時課税の対象だったかどうか */
  isSubjectToExitTax: boolean;
  /** 帰国を考慮しない、全保有資産を対象とした当初の試算結果 */
  originalResult: ExitTaxResult;
  /** 帰国要件を満たす場合に、引き続き保有していた資産分を除いて再計算した試算結果(満たさない場合は当初と同じ) */
  revisedResult: ExitTaxResult;
  /** 更正の請求により還付され得る税額(originalResult.totalTaxJpy - revisedResult.totalTaxJpy) */
  refundableTaxJpy: Decimal;
  notes: string[];
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date.getTime());
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setMonth(result.getMonth() + months);
  return result;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function estimateExitTaxCancellation(
  input: ExitTaxCancellationInput,
): ExitTaxCancellationResult {
  const exitDate = new Date(input.exitDate);
  const returnDate = new Date(input.returnDate);
  if (Number.isNaN(exitDate.getTime())) {
    throw new Error("国外転出の日の形式が不正です");
  }
  if (Number.isNaN(returnDate.getTime())) {
    throw new Error("帰国の日の形式が不正です");
  }
  if (returnDate.getTime() < exitDate.getTime()) {
    throw new Error("帰国の日は国外転出の日以後の日付である必要があります");
  }

  const deadlineYears = input.hasTaxDeferralExtension ? 10 : 5;
  const deadlineDate = addYears(exitDate, deadlineYears);
  const meetsReturnDeadline = returnDate.getTime() <= deadlineDate.getTime();
  const amendedReturnDeadlineDate = toIsoDate(addMonths(returnDate, 4));

  const originalResult = estimateExitTax({
    holdings: input.holdings,
    domesticResidenceYearsInPast10Years: input.domesticResidenceYearsInPast10Years,
  });

  const canCancel = originalResult.isSubjectToExitTax && meetsReturnDeadline;
  const revisedHoldings = canCancel
    ? input.holdings.filter((h) => !h.stillHeldAtReturn)
    : input.holdings;
  const revisedResult = estimateExitTax({
    holdings: revisedHoldings,
    domesticResidenceYearsInPast10Years: input.domesticResidenceYearsInPast10Years,
  });

  const refundableTaxJpy = originalResult.totalTaxJpy.minus(revisedResult.totalTaxJpy);

  const notes: string[] = [
    "国税庁タックスアンサーNo.1478、所得税法60条の2第6項第1号による概算値。国外転出の日から5年(納税猶予制度(同法137条の2)の適用を受けている場合は10年)を経過する日までに帰国し、その帰国の時まで引き続き有していた対象資産に限り、更正の請求により当初の国外転出時課税を取り消すことができる。帰国前に譲渡・使用等をした対象資産は取消しの対象にならない。",
    "更正の請求の期限は帰国の日から4か月以内。",
    "保有数量の一部のみを帰国時まで保有していた場合(一部譲渡)は銘柄を保有継続分・譲渡済み分の2行に分けて入力すること(本ツールは銘柄単位で「引き続き保有」か「保有していない」かの二値でのみ判定する)。",
    "納税猶予期間中に実際の譲渡価額がこの試算の価額を下回った場合等の更正の請求による減額の特例(同法60条の2第7項・第8項)は対象外(金額計算は行わない)。",
    "還付され得る税額がマイナスになる場合(引き続き保有していた資産が含み損であり、除外すると課税対象額がかえって増える場合)は、更正の請求をすると不利になるため通常は請求しない。この判断はユーザーに委ね、本ツールでは自動判定しない。",
  ];

  return {
    meetsReturnDeadline,
    deadlineYears,
    amendedReturnDeadlineDate,
    isSubjectToExitTax: originalResult.isSubjectToExitTax,
    originalResult,
    revisedResult,
    refundableTaxJpy,
    notes,
  };
}
