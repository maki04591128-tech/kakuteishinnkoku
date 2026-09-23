import { Decimal } from "decimal.js";
import {
  RESIDENT_TAX_RATE,
  SEPARATE_NATIONAL_TAX_RATE,
  SEPARATE_RESIDENT_TAX_RATE,
  nationalIncomeTaxWithSurtaxJpy,
} from "../incomeTax";

/**
 * 上場株式等の配当所得は、確定申告にあたり次の3つの課税方式から
 * 1つを選択できる(令和5年分以降、所得税と住民税は同一の方式を選ぶ必要がある)。
 *
 *  - 総合課税(COMPREHENSIVE): 他の所得と合算し、超過累進税率を適用する。
 *    配当控除(国税10%/5%・住民税2.8%/1.4%)が使えるが、上場株式等の
 *    譲渡損失とは損益通算できない。
 *  - 申告分離課税(SEPARATE): 配当所得のみを他の所得と分離し、一律
 *    20.315%(所得税15.315%+住民税5%)で課税する。配当控除は使えないが、
 *    上場株式等の譲渡損失(当年分+繰越控除分)と損益通算できる。
 *  - 申告不要(NO_FILING): 源泉徴収された20.315%で課税関係を終了させる。
 *    合計所得金額に含まれないため、配偶者控除等の所得判定や国民健康保険料
 *    への影響を避けられる場合があるが、損益通算はできない。
 *
 * このモジュールは3方式の税額を試算し、最も有利な方式を提案する。
 *
 * 配当控除率は銘柄種別により異なる(上場株式等の普通配当は通常税率、
 * 株式投資信託の分配金は半分、公社債投資信託・J-REIT等は対象外)。
 * `dividendCreditBreakdown`で内訳を渡すとそれぞれの税率区分ごとに
 * 正しく計算する(省略時は全額を通常税率(上場株式等)として扱う簡略化)。
 * `/dividend-simulation`ページでは`InvestmentTrade.assetType`から
 * 自動集計した内訳(`dividendCreditCategory`、`src/lib/investment/
 * calculator.ts`)を初期値として渡している。
 *
 * 簡略化している点(今後の課題):
 *  - 株式投資信託の半分税率は、外貨建資産等の組入割合が50%以下であることを
 *    前提とする。組入割合が50%を超え75%以下の場合はさらに率が下がり
 *    (通常の1/4)、75%超または公社債投資信託・REIT等は対象外だが、
 *    本ツールでは銘柄種別(STOCK/ETF/MUTUAL_FUND/BOND/OTHER)までしか
 *    区別していないため、MUTUAL_FUNDは一律半分税率として扱う。
 *  - 所得税額の計算は国税庁の「速算表」(超過累進税率)をそのまま使用し、
 *    住民税は10%固定(均等割は考慮しない)としている。
 *  - 総合課税を選ぶと合計所得金額が増え、配偶者控除・扶養控除の可否や
 *    国民健康保険料等に影響し得るが、本シミュレーターはこれらを金額として
 *    織り込まない(注意事項として案内するのみ)。
 */

export type DividendTaxMethod = "COMPREHENSIVE" | "SEPARATE" | "NO_FILING";

export interface DividendCreditBreakdown {
  /**
   * 配当等の金額(源泉徴収前)のうち、株式投資信託の分配金等、配当控除が
   * 半分の税率になる分。省略時は0。
   */
  halfCreditJpy?: Decimal.Value;
  /**
   * 配当等の金額(源泉徴収前)のうち、公社債投資信託・J-REIT等、配当控除の
   * 対象外の分。省略時は0。
   */
  noCreditJpy?: Decimal.Value;
}

export interface DividendTaxSimulationInput {
  /** その年の配当所得金額(源泉徴収前の総額。全税率区分の合計) */
  dividendIncomeJpy: Decimal.Value;
  /**
   * dividendIncomeJpyの税率区分ごとの内訳(総合課税を選んだ場合の配当控除の
   * 計算に使用)。半分税率・対象外の分のみ指定し、残り(dividendIncomeJpyから
   * それらを差し引いた額)を通常税率(上場株式等の普通配当)として扱う。
   * 省略時は全額を通常税率として扱う。
   */
  dividendCreditBreakdown?: DividendCreditBreakdown;
  /** 配当以外の課税所得金額(給与所得等、各種所得控除後の金額) */
  otherTaxableIncomeJpy: Decimal.Value;
  /**
   * 申告分離課税を選択した場合に配当所得と損益通算できる、上場株式等の
   * 譲渡損失額(当年の譲渡損失+前年以前3年以内の繰越控除未使用分の合計)。
   * 未指定の場合は0として扱う。
   */
  availableListedStockLossJpy?: Decimal.Value;
}

export interface DividendTaxMethodResult {
  method: DividendTaxMethod;
  /** 損益通算後、実際に課税対象となる配当所得金額 */
  taxableDividendJpy: Decimal;
  nationalTaxJpy: Decimal;
  residentTaxJpy: Decimal;
  totalTaxJpy: Decimal;
  /** 総合課税の場合のみ: 配当控除額(国税+住民税) */
  dividendCreditJpy?: Decimal;
  /** 申告分離課税の場合のみ: 損益通算に使用した譲渡損失額 */
  lossOffsetUsedJpy?: Decimal;
}

export interface DividendTaxSimulationResult {
  comprehensive: DividendTaxMethodResult;
  separate: DividendTaxMethodResult;
  noFiling: DividendTaxMethodResult;
  recommendedMethod: DividendTaxMethod;
  /** 未使用のまま残る譲渡損失の繰越額(申告分離課税を選んだ場合) */
  remainingListedStockLossJpy: Decimal;
  notes: string[];
}

// 配当控除の適用対象となる合計所得金額の閾値(これを超える部分は控除率が半減)
const DIVIDEND_CREDIT_THRESHOLD_JPY = new Decimal(10_000_000);

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

/**
 * 金額を「合計所得金額1,000万円の枠内(below)」「枠を超える部分(above)」に
 * 分割する。複数の配当控除税率区分がある場合、通常税率(FULL)の分から
 * 順に枠を消費し、残った枠を半分税率(HALF)の分に充てる
 * (配当控除の対象外(NONE)の分は枠を消費しない。今後の課題参照)。
 */
function splitByThreshold(
  amount: Decimal,
  roomBelowThreshold: Decimal,
): { below: Decimal; above: Decimal; remainingRoom: Decimal } {
  const below = Decimal.min(amount, roomBelowThreshold);
  const above = amount.minus(below);
  return { below, above, remainingRoom: roomBelowThreshold.minus(below) };
}

/**
 * 配当所得を総合課税で申告した場合の配当控除額を計算する。
 * 合計所得金額が1,000万円を超える部分に対応する配当は控除率が半分になる
 * (税率区分ごとの詳細は`dividendCreditCategory`のコメント参照)。
 */
function dividendCreditJpy(
  otherTaxableIncomeJpy: Decimal,
  fullCreditDividendJpy: Decimal,
  halfCreditDividendJpy: Decimal,
): { nationalCreditJpy: Decimal; residentCreditJpy: Decimal } {
  const roomBelowThreshold = Decimal.max(
    DIVIDEND_CREDIT_THRESHOLD_JPY.minus(otherTaxableIncomeJpy),
    0,
  );

  const full = splitByThreshold(fullCreditDividendJpy, roomBelowThreshold);
  const half = splitByThreshold(halfCreditDividendJpy, full.remainingRoom);

  const nationalCreditJpy = full.below
    .times(0.1)
    .plus(full.above.times(0.05))
    .plus(half.below.times(0.05))
    .plus(half.above.times(0.025));
  const residentCreditJpy = full.below
    .times(0.028)
    .plus(full.above.times(0.014))
    .plus(half.below.times(0.014))
    .plus(half.above.times(0.007));

  return { nationalCreditJpy, residentCreditJpy };
}

function simulateComprehensive(
  otherTaxableIncomeJpy: Decimal,
  dividendIncomeJpy: Decimal,
  fullCreditDividendJpy: Decimal,
  halfCreditDividendJpy: Decimal,
): DividendTaxMethodResult {
  const nationalTaxWithoutDividend = nationalIncomeTaxWithSurtaxJpy(otherTaxableIncomeJpy);
  const nationalTaxWithDividend = nationalIncomeTaxWithSurtaxJpy(
    otherTaxableIncomeJpy.plus(dividendIncomeJpy),
  );
  const marginalNationalTaxJpy = nationalTaxWithDividend.minus(nationalTaxWithoutDividend);

  const { nationalCreditJpy, residentCreditJpy } = dividendCreditJpy(
    otherTaxableIncomeJpy,
    fullCreditDividendJpy,
    halfCreditDividendJpy,
  );

  const nationalTaxJpy = marginalNationalTaxJpy.minus(nationalCreditJpy);
  const residentTaxJpy = dividendIncomeJpy.times(RESIDENT_TAX_RATE).minus(residentCreditJpy);

  return {
    method: "COMPREHENSIVE",
    taxableDividendJpy: dividendIncomeJpy,
    nationalTaxJpy,
    residentTaxJpy,
    totalTaxJpy: nationalTaxJpy.plus(residentTaxJpy),
    dividendCreditJpy: nationalCreditJpy.plus(residentCreditJpy),
  };
}

function simulateSeparate(
  dividendIncomeJpy: Decimal,
  availableListedStockLossJpy: Decimal,
): DividendTaxMethodResult {
  const lossOffsetUsedJpy = Decimal.min(availableListedStockLossJpy, dividendIncomeJpy);
  const taxableDividendJpy = dividendIncomeJpy.minus(lossOffsetUsedJpy);

  const nationalTaxJpy = taxableDividendJpy.times(SEPARATE_NATIONAL_TAX_RATE);
  const residentTaxJpy = taxableDividendJpy.times(SEPARATE_RESIDENT_TAX_RATE);

  return {
    method: "SEPARATE",
    taxableDividendJpy,
    nationalTaxJpy,
    residentTaxJpy,
    totalTaxJpy: nationalTaxJpy.plus(residentTaxJpy),
    lossOffsetUsedJpy,
  };
}

function simulateNoFiling(dividendIncomeJpy: Decimal): DividendTaxMethodResult {
  const nationalTaxJpy = dividendIncomeJpy.times(SEPARATE_NATIONAL_TAX_RATE);
  const residentTaxJpy = dividendIncomeJpy.times(SEPARATE_RESIDENT_TAX_RATE);

  return {
    method: "NO_FILING",
    taxableDividendJpy: dividendIncomeJpy,
    nationalTaxJpy,
    residentTaxJpy,
    totalTaxJpy: nationalTaxJpy.plus(residentTaxJpy),
  };
}

export function simulateDividendTaxation(
  input: DividendTaxSimulationInput,
): DividendTaxSimulationResult {
  const dividendIncomeJpy = new Decimal(input.dividendIncomeJpy);
  const otherTaxableIncomeJpy = new Decimal(input.otherTaxableIncomeJpy);
  const availableListedStockLossJpy = input.availableListedStockLossJpy
    ? new Decimal(input.availableListedStockLossJpy)
    : new Decimal(0);
  const halfCreditDividendJpy = input.dividendCreditBreakdown?.halfCreditJpy
    ? new Decimal(input.dividendCreditBreakdown.halfCreditJpy)
    : new Decimal(0);
  const noCreditDividendJpy = input.dividendCreditBreakdown?.noCreditJpy
    ? new Decimal(input.dividendCreditBreakdown.noCreditJpy)
    : new Decimal(0);

  requireNonNegative(dividendIncomeJpy, "配当所得金額");
  requireNonNegative(otherTaxableIncomeJpy, "配当以外の課税所得金額");
  requireNonNegative(availableListedStockLossJpy, "損益通算可能な譲渡損失額");
  requireNonNegative(halfCreditDividendJpy, "配当控除半分税率の内訳額");
  requireNonNegative(noCreditDividendJpy, "配当控除対象外の内訳額");
  if (halfCreditDividendJpy.plus(noCreditDividendJpy).greaterThan(dividendIncomeJpy)) {
    throw new Error(
      "配当控除の内訳額(半分税率+対象外)の合計が配当所得金額を超えています",
    );
  }
  const fullCreditDividendJpy = dividendIncomeJpy
    .minus(halfCreditDividendJpy)
    .minus(noCreditDividendJpy);

  const comprehensive = simulateComprehensive(
    otherTaxableIncomeJpy,
    dividendIncomeJpy,
    fullCreditDividendJpy,
    halfCreditDividendJpy,
  );
  const separate = simulateSeparate(dividendIncomeJpy, availableListedStockLossJpy);
  const noFiling = simulateNoFiling(dividendIncomeJpy);

  const candidates = [comprehensive, separate, noFiling];
  const recommended = candidates.reduce((best, current) =>
    current.totalTaxJpy.lessThan(best.totalTaxJpy) ? current : best,
  );

  const remainingListedStockLossJpy = availableListedStockLossJpy.minus(
    separate.lossOffsetUsedJpy ?? new Decimal(0),
  );

  const notes: string[] = [
    "所得税・住民税は令和5年分以降、同一の課税方式を選択する必要がある(方式を所得税と住民税で分けることはできない)。",
    "総合課税を選ぶと合計所得金額が増加し、配偶者控除・扶養控除の判定や国民健康保険料等に影響する場合がある(本シミュレーターの税額には含まれない)。",
    "申告不要制度を選んだ配当は、上場株式等の譲渡損失と損益通算できない。",
  ];
  if (availableListedStockLossJpy.greaterThan(0) && recommended.method !== "SEPARATE") {
    notes.push(
      "譲渡損失を損益通算に使うには申告分離課税を選ぶ必要がある。他の方式の税額が低い場合でも、繰越控除の期限(損失発生年から3年)が近い場合は申告分離課税を検討すること。",
    );
  }
  if (noCreditDividendJpy.greaterThan(0)) {
    notes.push(
      `配当所得のうち${noCreditDividendJpy.toString()}円分(公社債投資信託・J-REIT等)は総合課税を選んでも配当控除の対象外。`,
    );
  }

  return {
    comprehensive,
    separate,
    noFiling,
    recommendedMethod: recommended.method,
    remainingListedStockLossJpy,
    notes,
  };
}
