import { Decimal } from "decimal.js";
import { prisma } from "./db";

/**
 * 認定住宅等新築等特別税額控除(投資型減税。租税特別措置法41条の19の4。
 * 国税庁タックスアンサーNo.1221)。
 *
 * 個人が認定長期優良住宅・認定低炭素住宅(あわせて「認定住宅」)または
 * ZEH水準省エネ住宅の新築または未使用住宅の取得をして居住の用に供した場合に、
 * 住宅ローン控除(`mortgageDeduction.ts`)とは異なり借入金の有無を問わず
 * (自己資金のみで取得した場合も対象)、認定基準に適合するために必要となる
 * 標準的なかかり増し費用の10%相当額をその年分の所得税額から控除できる制度。
 * 住宅耐震改修特別控除・住宅特定改修特別税額控除(5類型)と同様、他の税額控除の
 * 適用順序の後段に位置づけられる借入金不要の住宅関連税額控除の1つ。
 *
 * 計算式(令和4年1月1日以後に居住の用に供した場合):
 *   標準的なかかり増し費用 = 1平方メートル当たり45,300円 × 床面積
 *   控除額 = min(標準的なかかり増し費用, 控除対象限度額650万円) × 10%
 *     (100円未満切り捨て)
 * 認定住宅(認定長期優良住宅・認定低炭素住宅)・ZEH水準省エネ住宅のいずれも、
 * 令和4年(2022年)1月1日から令和10年(2028年)12月31日までの居住分は
 * 単価(45,300円/㎡)・控除対象限度額(650万円)・控除率(10%)が共通のため、
 * `housingType`は要件確認・記録用の情報として保持するのみで計算結果には
 * 影響しない。
 *
 * 主な適用要件(国税庁タックスアンサーNo.1221に基づく):
 *  - 新築または建築後使用されたことのない住宅の取得であること(中古住宅の取得は対象外)。
 *  - 取得等の日から6か月以内に居住の用に供していること。
 *  - この控除を受ける年分の合計所得金額が2,000万円以下(令和5年12月31日までに
 *    居住の用に供している場合は3,000万円以下)であること。
 *  - 床面積が50平方メートル以上であり、床面積の2分の1以上が専ら自己の居住の用に
 *    供するものであること(住宅ローン控除のような40㎡以上50㎡未満の特例は無い)。
 *  - 2以上の住宅を所有している場合は、主として居住の用に供すると認められる住宅であること。
 *  - 居住年およびその前後合計6年間に、居住用財産の譲渡所得の特例(措法31の3・35条等)の
 *    適用を受けていないこと。
 *  - 同一の新築等について住宅借入金等特別控除(住宅ローン控除)の選択適用を受けないこと
 *    (両制度は選択適用で、一度選択すると選択替えはできない)。
 *
 * 居住年の所得税額から控除しきれない場合(または居住年に確定申告書を提出
 * すべき場合・提出できる場合のいずれにも該当しない場合)は、翌年分の所得税額
 * から「控除未済税額控除額」を控除できる1年間限りの繰越制度がある(国税庁
 * タックスアンサーNo.1221)。居住年分の試算画面(この控除の適用前の所得税額を
 * 入力すると控除しきれない金額を試算できる)から翌年分として直接登録でき、
 * 繰越を使う年の画面で当年分の登録額に合算すると
 * `CertifiedHousingConstructionCreditCarryforward`から`CertifiedHousingConstructionCreditRecord`
 * へ繰り越される(合算後は繰越データを消費済みとして削除する。1年限りの
 * 繰越のため、合算後さらに翌々年へ繰り越すことはない)。繰越の適用には居住年・
 * 翌年の両方の年分の合計所得金額がこの控除の所得要件(2,000万円以下。居住年が
 * 令和5年までであれば3,000万円以下)を満たす必要があり、翌年分の要件は
 * ユーザー自身が確認する前提とする。
 *
 * **制約(今後の課題):**
 *  - 令和4年(2022年)1月1日より前に居住の用に供した場合は、限度額が消費税率
 *    (8%・10%)により650万円/500万円に分かれる場合があるなど算式・要件が
 *    異なり、本ツールはその判定情報を持たないため対象外とする。
 *  - 個人が災害危険区域等内において新築(建替えを除く)または未使用住宅の
 *    取得をした場合、その住宅を令和10年(2028年)1月1日以後に居住の用に
 *    供したときはこの特別控除は適用できない特例があるが、住所・区域情報を
 *    扱う必要があり本ツールのスコープを超えるため判定は行わない
 *    (該当の可能性がある場合はユーザー自身が確認すること)。
 *  - 住民税に相当する控除制度は存在しない(所得税のみの制度。住宅耐震改修
 *    特別控除・住宅特定改修特別税額控除と同様)。
 */

export type CertifiedHousingType = "CERTIFIED" | "ZEH";

export const CERTIFIED_HOUSING_TYPE_LABEL: Record<CertifiedHousingType, string> = {
  CERTIFIED: "認定住宅(認定長期優良住宅・認定低炭素住宅)",
  ZEH: "ZEH水準省エネ住宅",
};

const UNIT_COST_PER_SQM_JPY = new Decimal(45_300);
const CONTROL_LIMIT_JPY = new Decimal(6_500_000);
const CREDIT_RATE = 0.1;
const MIN_FLOOR_AREA_SQM = new Decimal(50);
const TOTAL_INCOME_LIMIT_JPY = new Decimal(20_000_000);
const TOTAL_INCOME_LIMIT_THROUGH_2023_JPY = new Decimal(30_000_000);

const EARLIEST_SUPPORTED_RESIDENCE_YEAR = 2022;
const LATEST_RESIDENCE_YEAR = 2028;
const HIGHER_INCOME_LIMIT_LATEST_RESIDENCE_YEAR = 2023;

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

function floorToHundredYen(value: Decimal): Decimal {
  return value.dividedBy(100).floor().times(100);
}

export interface CertifiedHousingConstructionCreditInput {
  /** 認定住宅等の新築または取得をして居住の用に供した年(西暦) */
  residenceYear: number;
  /** 住宅の区分(認定住宅またはZEH水準省エネ住宅。要件確認用で計算結果には影響しない) */
  housingType: CertifiedHousingType;
  /** 床面積(平方メートル) */
  floorAreaSqm: Decimal.Value;
  /** この特別控除を受ける年分の合計所得金額 */
  totalIncomeJpy: Decimal.Value;
  /** 新築または建築後使用されたことのない住宅の取得であるか */
  isNewOrUnusedAcquisition: boolean;
  /** 新築または取得の日から6か月以内に居住の用に供したか */
  occupiedWithinSixMonths: boolean;
  /** 床面積の2分の1以上の部分が専ら自己の居住の用に供するものか */
  atLeastHalfOwnResidence: boolean;
  /** 2以上の住宅を所有している場合、主として居住の用に供すると認められる住宅か(1つしか所有していなければtrue) */
  isMainResidenceAmongMultipleHomes: boolean;
  /** 居住年の前後合計6年間に居住用財産の譲渡所得の特例(措法31の3・35条等)の適用を受けたか */
  usedHomeSaleCapitalGainsExclusion: boolean;
  /** 同一の新築等について住宅借入金等特別控除(住宅ローン控除)を選択するか(選択適用のため両方は受けられない) */
  choseMortgageDeductionInstead: boolean;
  /**
   * この控除の適用前の所得税額(他の税額控除適用後。概算)。指定すると、
   * 居住年の所得税額から控除しきれず翌年分に繰り越せる金額(控除未済税額
   * 控除額)を試算する。未指定の場合は居住年の所得税額で全額控除できるものと
   * 仮定し、繰越額は0円として扱う。
   */
  taxBeforeThisCreditJpy?: Decimal.Value;
}

export interface CertifiedHousingConstructionCreditResult {
  eligible: boolean;
  ineligibleReason?: string;
  floorAreaSqm: Decimal;
  /** 標準的なかかり増し費用(1㎡当たり45,300円×床面積) */
  incrementalCostJpy: Decimal;
  /** 控除対象限度額(650万円) */
  controlLimitJpy: Decimal;
  /** 控除額の計算基準額(標準的なかかり増し費用を控除対象限度額で頭打ちした金額) */
  cappedCostJpy: Decimal;
  /** 控除額(所得税分のみ。居住年分。100円未満切り捨て) */
  creditJpy: Decimal;
  /**
   * 居住年の所得税額から実際に控除できる額(taxBeforeThisCreditJpyを指定した
   * 場合はcreditJpyとの少ない方、未指定の場合はcreditJpyと同額)
   */
  appliedJpy: Decimal;
  /**
   * 翌年分に繰り越せる控除未済税額控除額(creditJpy - appliedJpy)。
   * taxBeforeThisCreditJpyを指定した場合のみ0円を超えうる。
   */
  carryforwardJpy: Decimal;
  notes: string[];
}

/**
 * 認定住宅等新築等特別税額控除額(居住年分)を試算する。DBに依存しない純粋関数。
 */
export function estimateCertifiedHousingConstructionCredit(
  input: CertifiedHousingConstructionCreditInput,
): CertifiedHousingConstructionCreditResult {
  const floorAreaSqm = new Decimal(input.floorAreaSqm);
  const totalIncomeJpy = new Decimal(input.totalIncomeJpy);
  requireNonNegative(floorAreaSqm, "床面積");
  requireNonNegative(totalIncomeJpy, "合計所得金額");

  const notes: string[] = [
    "租税特別措置法41条の19の4・国税庁タックスアンサーNo.1221(令和4年1月1日以後に居住の用に供した場合の算式)に基づく概算値。住宅ローン控除と異なり借入金の有無を問わないが、同一の新築等について住宅ローン控除との選択適用(選択替え不可)となる。",
    "住民税に相当する控除制度は存在しないため、所得税額からのみ控除する(住宅耐震改修特別控除・住宅特定改修特別税額控除の各類型と同様)。",
    "居住年の所得税額から控除しきれない場合等は翌年分に1年間だけ繰り越せる制度(控除未済税額控除額)がある。",
  ];

  function ineligible(reason: string): CertifiedHousingConstructionCreditResult {
    return {
      eligible: false,
      ineligibleReason: reason,
      floorAreaSqm,
      incrementalCostJpy: new Decimal(0),
      controlLimitJpy: new Decimal(0),
      cappedCostJpy: new Decimal(0),
      creditJpy: new Decimal(0),
      appliedJpy: new Decimal(0),
      carryforwardJpy: new Decimal(0),
      notes,
    };
  }

  if (input.residenceYear < EARLIEST_SUPPORTED_RESIDENCE_YEAR) {
    return ineligible(
      "令和4年(2022年)より前に居住の用に供した場合は控除対象限度額の判定(工事費用等に含まれる消費税率による650万円/500万円との区分等)が異なり、本ツールでは試算対象外とする。",
    );
  }
  if (input.residenceYear > LATEST_RESIDENCE_YEAR) {
    return ineligible(
      "適用期限(令和10年(2028年)12月31日までに居住の用に供したもの)を過ぎているため対象外(延長の可能性があるため国税庁の最新情報を確認すること)。",
    );
  }

  const totalIncomeLimitJpy =
    input.residenceYear <= HIGHER_INCOME_LIMIT_LATEST_RESIDENCE_YEAR
      ? TOTAL_INCOME_LIMIT_THROUGH_2023_JPY
      : TOTAL_INCOME_LIMIT_JPY;
  if (totalIncomeJpy.greaterThan(totalIncomeLimitJpy)) {
    return ineligible(
      `合計所得金額がこの特別控除を受けるための上限(${totalIncomeLimitJpy.toString()}円)を超えるため対象外。`,
    );
  }
  if (floorAreaSqm.lessThan(MIN_FLOOR_AREA_SQM)) {
    return ineligible("床面積が50平方メートル以上であることが要件(40㎡以上50㎡未満の特例は無い)。");
  }
  if (!input.atLeastHalfOwnResidence) {
    return ineligible("床面積の2分の1以上の部分が専ら自己の居住の用に供するものであることが要件。");
  }
  if (!input.isNewOrUnusedAcquisition) {
    return ineligible("認定住宅等の新築、または建築後使用されたことのない認定住宅等の取得であることが要件(中古住宅の取得は対象外)。");
  }
  if (!input.occupiedWithinSixMonths) {
    return ineligible("住宅の新築または取得の日から6か月以内に居住の用に供していることが要件。");
  }
  if (!input.isMainResidenceAmongMultipleHomes) {
    return ineligible("2以上の住宅を所有している場合、主として居住の用に供すると認められる住宅であることが要件。");
  }
  if (input.usedHomeSaleCapitalGainsExclusion) {
    return ineligible(
      "居住年およびその前後合計6年間に、居住用財産の譲渡所得の特例(措法31の3・35条等)の適用を受けている場合は対象外。",
    );
  }
  if (input.choseMortgageDeductionInstead) {
    return ineligible(
      "同一の新築等について住宅借入金等特別控除(住宅ローン控除)の適用を受ける場合、この認定住宅等新築等特別税額控除は選択適用できない(選択替え不可)。",
    );
  }

  const incrementalCostJpy = floorAreaSqm.times(UNIT_COST_PER_SQM_JPY);
  const cappedCostJpy = Decimal.min(incrementalCostJpy, CONTROL_LIMIT_JPY);
  const creditJpy = floorToHundredYen(cappedCostJpy.times(CREDIT_RATE));

  if (incrementalCostJpy.greaterThan(CONTROL_LIMIT_JPY)) {
    notes.push(
      `標準的なかかり増し費用(45,300円×床面積)が控除対象限度額(${CONTROL_LIMIT_JPY.toString()}円)を超えるため、控除額の計算上は限度額で頭打ちにした。`,
    );
  }
  if (input.residenceYear <= HIGHER_INCOME_LIMIT_LATEST_RESIDENCE_YEAR) {
    notes.push("令和5年(2023年)までに居住の用に供しているため、合計所得金額の上限は3,000万円を適用した。");
  }

  let appliedJpy = creditJpy;
  let carryforwardJpy = new Decimal(0);
  if (input.taxBeforeThisCreditJpy !== undefined) {
    const taxBeforeThisCreditJpy = new Decimal(input.taxBeforeThisCreditJpy);
    requireNonNegative(taxBeforeThisCreditJpy, "この控除の適用前の所得税額");
    appliedJpy = Decimal.min(creditJpy, taxBeforeThisCreditJpy);
    carryforwardJpy = creditJpy.minus(appliedJpy);
    if (carryforwardJpy.greaterThan(0)) {
      notes.push(
        `居住年の所得税額(${taxBeforeThisCreditJpy.toString()}円)から控除しきれない${carryforwardJpy.toString()}円は、翌年分(1年間のみ)の所得税額から「控除未済税額控除額」として控除できる。居住年・翌年の両方の年分の合計所得金額が上限(${totalIncomeLimitJpy.toString()}円)以下であることが要件(翌年分の要件はその年に確認すること)。`,
      );
    }
  } else {
    notes.push(
      "この控除の適用前の所得税額を入力すると、居住年の所得税額から控除しきれず翌年分に繰り越せる金額(控除未済税額控除額)を試算できる(未入力の場合は全額を居住年で控除できるものと仮定する)。",
    );
  }

  return {
    eligible: true,
    floorAreaSqm,
    incrementalCostJpy,
    controlLimitJpy: CONTROL_LIMIT_JPY,
    cappedCostJpy,
    creditJpy,
    appliedJpy,
    carryforwardJpy,
    notes,
  };
}

export interface CertifiedHousingConstructionCreditRecordEntry {
  taxYear: number;
  /** その年分の控除額(所得税分のみ。CertifiedHousingConstructionCreditResult.creditJpy) */
  creditJpy: Decimal;
}

/**
 * `/certified-housing-construction-credit`で登録済みの、指定した年分の認定住宅等
 * 新築等特別税額控除額をDBから読み出す。住宅耐震改修特別控除等と同様、下書きCSV
 * (`/api/export`)の税額控除欄・`/tax-estimate`の合計税額試算への自動反映に使う。
 * 未登録の年は null を返す。
 */
export async function getCertifiedHousingConstructionCreditRecord(
  year: number,
): Promise<CertifiedHousingConstructionCreditRecordEntry | null> {
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (!taxYear) return null;

  const record = await prisma.certifiedHousingConstructionCreditRecord.findUnique({
    where: { taxYearId: taxYear.id },
  });
  if (!record) return null;

  return {
    taxYear: year,
    creditJpy: new Decimal(record.creditJpy.toString()),
  };
}

export interface CertifiedHousingConstructionCreditCarryforwardEntry {
  /** 繰越額を使える年(暦年。居住年の翌年) */
  taxYear: number;
  /** 繰越元の居住年(暦年) */
  originYear: number;
  /** 翌年分に繰り越された控除未済税額控除額 */
  remainingAmountJpy: Decimal;
}

/**
 * 指定した年分(taxYear)に使える控除未済税額控除額の繰越(居住年の翌年分のみ)を
 * DBから読み出す。`carryForwardCertifiedHousingConstructionCreditExcess`で
 * 登録済みで、まだ`applyCertifiedHousingConstructionCreditCarryforward`で
 * 合算・消費されていない場合のみ値を返す。未登録の年は null を返す。
 */
export async function getCertifiedHousingConstructionCreditCarryforward(
  year: number,
): Promise<CertifiedHousingConstructionCreditCarryforwardEntry | null> {
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (!taxYear) return null;

  const record = await prisma.certifiedHousingConstructionCreditCarryforward.findUnique({
    where: { taxYearId: taxYear.id },
  });
  if (!record) return null;

  return {
    taxYear: year,
    originYear: record.originYear,
    remainingAmountJpy: new Decimal(record.remainingAmountJpy.toString()),
  };
}
