import { Decimal } from "decimal.js";
import { SEPARATE_NATIONAL_TAX_RATE, SEPARATE_RESIDENT_TAX_RATE } from "../incomeTax";

/**
 * 特定公社債(国債・地方債・公募公社債・上場公社債投資信託等)の利子等は、
 * 平成28年1月1日以後、源泉分離課税(申告不可)から金融所得課税の一体化により
 * 「申告分離課税」または「申告不要」の選択制に変わった(措置法3条の3・8条の4)。
 * 配当所得と異なり総合課税は選択できない(総合課税は一般公社債等の利子で
 * 同族会社の役員等がその同族会社発行の社債につき受ける利子等、限られた
 * ケースのみのため、本ツールのスコープ外とする)。
 *
 *  - 申告分離課税(SEPARATE): 利子所得のみを他の所得と分離し、一律
 *    20.315%(所得税15.315%+住民税5%)で課税する。上場株式等の譲渡損失
 *    (当年分+繰越控除分)・申告分離課税を選択した配当所得と損益通算できる。
 *  - 申告不要(NO_FILING): 源泉徴収された20.315%で課税関係を終了させる。
 *    合計所得金額に含まれないため、配偶者控除等の所得判定や国民健康保険料
 *    への影響を避けられる場合があるが、損益通算はできない。
 *
 * 利子所得の金額は収入金額(源泉徴収前)がそのまま所得金額になり、必要経費の
 * 控除は無い(所得税法23条2項)。源泉徴収税額は所得税15.315%・住民税5%が
 * 既に差し引かれているため、申告不要を選ぶ場合は追加の納税・還付は生じない。
 * 申告分離課税を選ぶ場合も源泉徴収された税額は所得税の前払い(住民税は
 * 特別徴収)として精算される前提とし、本シミュレーターは損益通算前の
 * 20.315%相当額との差額(還付見込み額)の試算は行わず、損益通算後の
 * 税額そのものを算出するにとどめる(実際の還付額の計算は源泉徴収税額を
 * 差し引いて別途確認すること)。
 *
 * 一般公社債等(特定公社債に該当しないもの)の利子は原則として源泉分離課税
 * (20.315%の源泉徴収のみで課税関係が終了し、申告分離課税・申告不要の
 * 選択自体ができない)のままのため、このシミュレーターの対象は特定公社債の
 * 利子等に限る(一般公社債等は源泉徴収のみで確定申告の対象外であり、
 * そもそも申告方式を選ぶ必要が無い)。
 *
 * 簡略化している点(今後の課題):
 *  - 住民税は所得割5%固定として計算する(申告分離課税の税率そのものであり
 *    均等割・調整控除は考慮しない)。
 */

export type InterestIncomeTaxMethod = "SEPARATE" | "NO_FILING";

export interface InterestIncomeTaxSimulationInput {
  /** その年の特定公社債の利子等の収入金額(源泉徴収前) */
  interestIncomeJpy: Decimal.Value;
  /**
   * 申告分離課税を選択した場合に利子所得と損益通算できる、上場株式等の
   * 譲渡損失額(当年の譲渡損失+前年以前3年以内の繰越控除未使用分の合計)。
   * 未指定の場合は0として扱う。
   */
  availableListedStockLossJpy?: Decimal.Value;
}

export interface InterestIncomeTaxMethodResult {
  method: InterestIncomeTaxMethod;
  /** 損益通算後、実際に課税対象となる利子所得金額 */
  taxableInterestJpy: Decimal;
  nationalTaxJpy: Decimal;
  residentTaxJpy: Decimal;
  totalTaxJpy: Decimal;
  /** 申告分離課税の場合のみ: 損益通算に使用した譲渡損失額 */
  lossOffsetUsedJpy?: Decimal;
}

export interface InterestIncomeTaxSimulationResult {
  separate: InterestIncomeTaxMethodResult;
  noFiling: InterestIncomeTaxMethodResult;
  recommendedMethod: InterestIncomeTaxMethod;
  /** 未使用のまま残る譲渡損失の繰越額(申告分離課税を選んだ場合) */
  remainingListedStockLossJpy: Decimal;
  notes: string[];
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

function simulateSeparate(
  interestIncomeJpy: Decimal,
  availableListedStockLossJpy: Decimal,
): InterestIncomeTaxMethodResult {
  const lossOffsetUsedJpy = Decimal.min(availableListedStockLossJpy, interestIncomeJpy);
  const taxableInterestJpy = interestIncomeJpy.minus(lossOffsetUsedJpy);

  const nationalTaxJpy = taxableInterestJpy.times(SEPARATE_NATIONAL_TAX_RATE);
  const residentTaxJpy = taxableInterestJpy.times(SEPARATE_RESIDENT_TAX_RATE);

  return {
    method: "SEPARATE",
    taxableInterestJpy,
    nationalTaxJpy,
    residentTaxJpy,
    totalTaxJpy: nationalTaxJpy.plus(residentTaxJpy),
    lossOffsetUsedJpy,
  };
}

function simulateNoFiling(interestIncomeJpy: Decimal): InterestIncomeTaxMethodResult {
  const nationalTaxJpy = interestIncomeJpy.times(SEPARATE_NATIONAL_TAX_RATE);
  const residentTaxJpy = interestIncomeJpy.times(SEPARATE_RESIDENT_TAX_RATE);

  return {
    method: "NO_FILING",
    taxableInterestJpy: interestIncomeJpy,
    nationalTaxJpy,
    residentTaxJpy,
    totalTaxJpy: nationalTaxJpy.plus(residentTaxJpy),
  };
}

export function simulateBondInterestIncomeTaxation(
  input: InterestIncomeTaxSimulationInput,
): InterestIncomeTaxSimulationResult {
  const interestIncomeJpy = new Decimal(input.interestIncomeJpy);
  const availableListedStockLossJpy = input.availableListedStockLossJpy
    ? new Decimal(input.availableListedStockLossJpy)
    : new Decimal(0);

  requireNonNegative(interestIncomeJpy, "利子所得の収入金額");
  requireNonNegative(availableListedStockLossJpy, "損益通算可能な譲渡損失額");

  const separate = simulateSeparate(interestIncomeJpy, availableListedStockLossJpy);
  const noFiling = simulateNoFiling(interestIncomeJpy);

  const recommendedMethod: InterestIncomeTaxMethod = separate.totalTaxJpy.lessThan(
    noFiling.totalTaxJpy,
  )
    ? "SEPARATE"
    : "NO_FILING";

  const remainingListedStockLossJpy = availableListedStockLossJpy.minus(
    separate.lossOffsetUsedJpy ?? new Decimal(0),
  );

  const notes: string[] = [
    "対象は特定公社債(国債・地方債・公募公社債・上場公社債投資信託等)の利子等に限る。一般公社債等の利子は原則として源泉分離課税(源泉徴収のみで課税関係が終了)のため、そもそも申告分離課税・申告不要を選ぶ必要が無く、このシミュレーターの対象外。",
    "特定公社債の利子等は配当所得と異なり総合課税を選択できない(申告分離課税か申告不要のいずれか)。",
    "申告不要制度を選んだ利子等は、上場株式等の譲渡損失と損益通算できない。",
    "源泉徴収税額(所得税15.315%・住民税5%相当)は既に差し引かれている前提で、この試算は損益通算後の税額そのものを示す。申告分離課税を選んで損益通算により税額が源泉徴収税額を下回る場合、その差額が還付される。",
  ];
  if (availableListedStockLossJpy.greaterThan(0) && recommendedMethod !== "SEPARATE") {
    notes.push(
      "譲渡損失を損益通算に使うには申告分離課税を選ぶ必要がある。他の方式の税額が同額以下の場合でも、繰越控除の期限(損失発生年から3年)が近い場合は申告分離課税を検討すること。",
    );
  }

  return {
    separate,
    noFiling,
    recommendedMethod,
    remainingListedStockLossJpy,
    notes,
  };
}
