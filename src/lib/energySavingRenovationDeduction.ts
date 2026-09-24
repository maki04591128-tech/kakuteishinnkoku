import { Decimal } from "decimal.js";
import { prisma } from "./db";

/**
 * 省エネ改修工事をした場合の住宅特定改修特別税額控除(税額控除。租税特別措置法
 * 41条の19の3。国税庁タックスアンサーNo.1219)。
 *
 * 自己が所有する居住用家屋について一般断熱改修工事等(一般省エネ改修工事)を
 * 行い、平成26年4月1日から令和10年(2028年)12月31日までの間に自己の居住の用に
 * 供した場合に、住宅ローン控除(`mortgageDeduction.ts`)や住宅耐震改修特別控除
 * (`earthquakeRenovationDeduction.ts`)と同様、借入金の有無を問わずその年分の
 * 所得税額から控除できる制度。単年で完結する控除で繰越制度は無い。
 *
 * 計算式(国税庁タックスアンサーNo.1219に基づく。令和4年1月1日以後に居住の用に
 * 供した場合):
 *   控除額 = A×10% + B×5%(A・Bそれぞれ100円未満切り捨て)
 *   A = 一般省エネ改修工事の標準的な費用の額(補助金等控除後。控除対象限度額
 *       (250万円。太陽光発電設備設置工事を含む場合は350万円)を限度)
 *   B = 次の(1)(2)のいずれか低い金額(1,000万円からAを控除した金額を限度)
 *       (1) 標準的な費用の額のうち控除対象限度額を超える部分 + 併せて行う
 *           増築・改築その他の一定の工事に要した費用の額(補助金等控除後)
 *       (2) 一般省エネ改修工事の標準的な費用の額(頭打ち前)
 *
 * **制約:**
 *  - 住民税に相当する控除制度は存在しない(所得税のみの制度。住宅耐震改修
 *    特別控除と同様)。
 *  - 令和4年(2022年)1月1日より前に居住の用に供した場合は、控除対象限度額が
 *    工事費用に含まれる消費税率(8%・10%)により200万円/300万円になる場合が
 *    あるなど算式・要件が異なり、本ツールはこの古い制度のケースを判定する
 *    ための情報を持たないため対象外とする(今後の課題)。
 *  - この控除はバリアフリー改修(41条の19の3)・住宅耐震改修特別控除
 *    (41条の19の2)・多世帯同居改修・耐久性向上改修・子育て対応改修の各控除と
 *    併用した場合、B(増改築等工事費用分)の1,000万円の限度額を合算して
 *    判定する必要があるが、本ツールは省エネ改修工事単独での適用を前提とし、
 *    他の改修工事との併用時のB限度額の合算判定は行わない(今後の課題)。
 *  - 一般省エネ改修工事と併せて耐久性向上改修工事を行った場合(コード1227)は
 *    別制度のため対象外。
 */

const STANDARD_COST_MINIMUM_JPY = new Decimal(500_000);
const CONTROL_LIMIT_WITHOUT_SOLAR_JPY = new Decimal(2_500_000);
const CONTROL_LIMIT_WITH_SOLAR_JPY = new Decimal(3_500_000);
const RELATED_WORK_TOTAL_LIMIT_JPY = new Decimal(10_000_000);
const AMOUNT_A_CREDIT_RATE = 0.1;
const AMOUNT_B_CREDIT_RATE = 0.05;

const TOTAL_INCOME_LIMIT_AT_LEAST_50SQM_BEFORE_2024_JPY = new Decimal(30_000_000);
const TOTAL_INCOME_LIMIT_AT_LEAST_50SQM_FROM_2024_JPY = new Decimal(20_000_000);
const TOTAL_INCOME_LIMIT_40_TO_50SQM_JPY = new Decimal(10_000_000);

const EARLIEST_SUPPORTED_RESIDENCE_YEAR = 2022;
const LATEST_RESIDENCE_YEAR = 2028;
const FROM_40_TO_50SQM_EARLIEST_RESIDENCE_YEAR = 2026;

export type EnergySavingRenovationFloorAreaCategory = "AT_LEAST_50" | "FROM_40_TO_50";

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

function floorToHundredYen(value: Decimal): Decimal {
  return value.dividedBy(100).floor().times(100);
}

export interface EnergySavingRenovationDeductionInput {
  /** 改修後の住宅に自己の居住の用に供した年(西暦) */
  residenceYear: number;
  /** 床面積区分(50平方メートル以上か、40平方メートル以上50平方メートル未満か) */
  floorAreaCategory: EnergySavingRenovationFloorAreaCategory;
  /** この特別控除を受ける年分の合計所得金額 */
  totalIncomeJpy: Decimal.Value;
  /** 一般省エネ改修工事に係る標準的な費用の額(補助金等の額を控除した後の金額) */
  standardCostJpy: Decimal.Value;
  /** 太陽光発電設備設置工事を含むか(控除対象限度額が250万円→350万円に上がる) */
  includesSolarPanelWork: boolean;
  /** 一般省エネ改修工事と併せて行う増築・改築その他の一定の工事に要した費用の額(補助金等控除後) */
  otherRelatedWorkCostJpy?: Decimal.Value;
  /** 一般省エネ改修工事の日から6か月以内に居住の用に供したか */
  workCompletedWithinSixMonths: boolean;
  /** 工事費用の2分の1以上の額が自己の居住用部分の工事費用か */
  atLeastHalfCostForOwnResidence: boolean;
  /** その年の前年以前3年内の各年分に、同一住宅について一般省エネ改修工事に係るこの税額控除の適用を受けたか */
  usedSameCreditInPastThreeYears: boolean;
}

export interface EnergySavingRenovationDeductionResult {
  eligible: boolean;
  ineligibleReason?: string;
  standardCostJpy: Decimal;
  /** 控除対象限度額(太陽光発電設備設置工事の有無により250万円または350万円) */
  controlLimitJpy: Decimal;
  /** A: 標準的な費用の額のうち控除対象限度額までの部分(10%控除) */
  amountAJpy: Decimal;
  /** B: 控除対象限度額超過分+関連工事費用(1,000万円からAを控除した額を限度。5%控除) */
  amountBJpy: Decimal;
  /** 控除額(所得税分のみ。A・Bそれぞれ100円未満切り捨て) */
  creditJpy: Decimal;
  notes: string[];
}

/**
 * 省エネ改修工事をした場合の住宅特定改修特別税額控除額を試算する。
 * DBに依存しない純粋関数。
 */
export function estimateEnergySavingRenovationDeduction(
  input: EnergySavingRenovationDeductionInput,
): EnergySavingRenovationDeductionResult {
  const standardCostJpy = new Decimal(input.standardCostJpy);
  const totalIncomeJpy = new Decimal(input.totalIncomeJpy);
  const otherRelatedWorkCostJpy = input.otherRelatedWorkCostJpy
    ? new Decimal(input.otherRelatedWorkCostJpy)
    : new Decimal(0);
  requireNonNegative(standardCostJpy, "一般省エネ改修工事に係る標準的な費用の額");
  requireNonNegative(totalIncomeJpy, "合計所得金額");
  requireNonNegative(otherRelatedWorkCostJpy, "併せて行う増築・改築その他の一定の工事に要した費用の額");

  const notes: string[] = [
    "租税特別措置法41条の19の3・国税庁タックスアンサーNo.1219(令和4年1月1日以後に居住の用に供した場合の算式)に基づく概算値。住民税に相当する控除制度は存在しないため、所得税額からのみ控除する(住宅耐震改修特別控除と同様)。",
    "バリアフリー改修・住宅耐震改修特別控除・多世帯同居改修・耐久性向上改修・子育て対応改修等の他の住宅特定改修特別税額控除と併用する場合、B(増改築等工事費用分)の1,000万円の限度額は各改修工事のAの合計額を控除した額が限度になるが、本ツールは省エネ改修工事単独での適用を前提とし、他の改修工事との併用時の限度額の合算判定は行わない(今後の課題)。",
  ];

  function ineligible(reason: string): EnergySavingRenovationDeductionResult {
    return {
      eligible: false,
      ineligibleReason: reason,
      standardCostJpy,
      controlLimitJpy: new Decimal(0),
      amountAJpy: new Decimal(0),
      amountBJpy: new Decimal(0),
      creditJpy: new Decimal(0),
      notes,
    };
  }

  if (input.residenceYear < EARLIEST_SUPPORTED_RESIDENCE_YEAR) {
    return ineligible(
      `令和4年(2022年)より前に居住の用に供した場合は控除対象限度額の判定(工事費用に含まれる消費税率による200万円/300万円との区分等)が異なり、本ツールでは試算対象外とする。`,
    );
  }
  if (input.residenceYear > LATEST_RESIDENCE_YEAR) {
    return ineligible(
      `適用期限(令和10年(2028年)12月31日までに居住の用に供したもの)を過ぎているため対象外(延長の可能性があるため国税庁の最新情報を確認すること)。`,
    );
  }
  if (
    input.floorAreaCategory === "FROM_40_TO_50" &&
    input.residenceYear < FROM_40_TO_50SQM_EARLIEST_RESIDENCE_YEAR
  ) {
    return ineligible(
      "床面積40平方メートル以上50平方メートル未満の特例は令和8年(2026年)1月1日以後に居住の用に供した場合のみ対象。",
    );
  }

  const totalIncomeLimitJpy =
    input.floorAreaCategory === "FROM_40_TO_50"
      ? TOTAL_INCOME_LIMIT_40_TO_50SQM_JPY
      : input.residenceYear <= 2023
        ? TOTAL_INCOME_LIMIT_AT_LEAST_50SQM_BEFORE_2024_JPY
        : TOTAL_INCOME_LIMIT_AT_LEAST_50SQM_FROM_2024_JPY;
  if (totalIncomeJpy.greaterThan(totalIncomeLimitJpy)) {
    return ineligible(
      `合計所得金額がこの特別控除を受けるための上限(${totalIncomeLimitJpy.toString()}円)を超えるため対象外。`,
    );
  }

  if (standardCostJpy.lessThanOrEqualTo(STANDARD_COST_MINIMUM_JPY)) {
    return ineligible(
      "一般省エネ改修工事に係る標準的な費用の額(補助金等控除後)が50万円を超えることが要件。",
    );
  }
  if (!input.workCompletedWithinSixMonths) {
    return ineligible("一般省エネ改修工事の日から6か月以内に居住の用に供していることが要件。");
  }
  if (!input.atLeastHalfCostForOwnResidence) {
    return ineligible("工事費用の2分の1以上の額が自己の居住用部分の工事費用であることが要件。");
  }
  if (input.usedSameCreditInPastThreeYears) {
    return ineligible(
      "その年の前年以前3年内の各年分において、同一の住宅について一般省エネ改修工事に係るこの税額控除を適用した場合、重ねて適用することはできない。",
    );
  }

  const controlLimitJpy = input.includesSolarPanelWork
    ? CONTROL_LIMIT_WITH_SOLAR_JPY
    : CONTROL_LIMIT_WITHOUT_SOLAR_JPY;

  const amountAJpy = Decimal.min(standardCostJpy, controlLimitJpy);
  const excessOverLimitJpy = Decimal.max(standardCostJpy.minus(controlLimitJpy), 0);
  const amountBCandidate1Jpy = excessOverLimitJpy.plus(otherRelatedWorkCostJpy);
  const amountBCandidate2Jpy = standardCostJpy;
  const amountBBeforeCapJpy = Decimal.min(amountBCandidate1Jpy, amountBCandidate2Jpy);
  const amountBLimitJpy = Decimal.max(RELATED_WORK_TOTAL_LIMIT_JPY.minus(amountAJpy), 0);
  const amountBJpy = Decimal.min(amountBBeforeCapJpy, amountBLimitJpy);

  const creditJpy = floorToHundredYen(amountAJpy.times(AMOUNT_A_CREDIT_RATE)).plus(
    floorToHundredYen(amountBJpy.times(AMOUNT_B_CREDIT_RATE)),
  );

  if (input.includesSolarPanelWork) {
    notes.push("太陽光発電設備設置工事を含むため、控除対象限度額を350万円として計算した。");
  }
  if (standardCostJpy.greaterThan(controlLimitJpy)) {
    notes.push(
      `一般省エネ改修工事に係る標準的な費用の額が控除対象限度額(${controlLimitJpy.toString()}円)を超えるため、超過分は増築・改築その他の一定の工事に要した費用の額と合わせてB(5%控除)の対象とした。`,
    );
  }
  if (amountBBeforeCapJpy.greaterThan(amountBLimitJpy)) {
    notes.push("B(5%控除の対象額)が1,000万円からAを控除した限度額を超えるため頭打ちにした。");
  }

  return {
    eligible: true,
    standardCostJpy,
    controlLimitJpy,
    amountAJpy,
    amountBJpy,
    creditJpy,
    notes,
  };
}

export interface EnergySavingRenovationDeductionRecordEntry {
  taxYear: number;
  /** その年分の控除額(所得税分。EnergySavingRenovationDeductionResult.creditJpy) */
  creditJpy: Decimal;
}

/**
 * `/energy-saving-renovation-deduction`で登録済みの、指定した年分の省エネ改修
 * 住宅特定改修特別税額控除額をDBから読み出す。住宅耐震改修特別控除と同様、
 * 下書きCSV(`/api/export`)の税額控除欄・`/tax-estimate`の合計税額試算への
 * 自動反映に使う。未登録の年は null を返す。
 */
export async function getEnergySavingRenovationDeductionRecord(
  year: number,
): Promise<EnergySavingRenovationDeductionRecordEntry | null> {
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (!taxYear) return null;

  const record = await prisma.energySavingRenovationDeductionRecord.findUnique({
    where: { taxYearId: taxYear.id },
  });
  if (!record) return null;

  return {
    taxYear: year,
    creditJpy: new Decimal(record.creditJpy.toString()),
  };
}
