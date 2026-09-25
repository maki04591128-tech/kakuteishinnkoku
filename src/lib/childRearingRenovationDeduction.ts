import { Decimal } from "decimal.js";
import { prisma } from "./db";

/**
 * 子育て対応改修工事をした場合の住宅特定改修特別税額控除(税額控除。租税特別措置法
 * 41条の19の3。国税庁タックスアンサーNo.1228)。
 *
 * バリアフリー改修工事(`barrierFreeRenovationDeduction.ts`)・省エネ改修工事
 * (`energySavingRenovationDeduction.ts`)・多世帯同居改修工事
 * (`multiHouseholdRenovationDeduction.ts`)と同様、単独で適用できる標準的な費用の
 * 額に基づく控除だが、他の4類型と異なり(1)対象者が「特例対象個人」(19歳未満の
 * 扶養親族を有する者、または40歳未満の配偶者を有する者(自身か配偶者いずれかが
 * 40歳未満))に限定される点、(2)制度自体が令和6年度税制改正で新設され
 * 令和6年(2024年)4月1日から令和10年(2028年)12月31日までの間の居住分のみが
 * 対象という時限的な制度である点が異なる(国税庁タックスアンサーNo.1228)。
 *
 * 対象となる子育て対応改修工事は、(1)子どもの事故防止工事(壁の出隅の面取り、
 * 床材の切替、手すりの設置、戸の切替、柵の設置、コンセントの切替等)、
 * (2)対面式キッチンへの取替工事、(3)侵入防止対策を施した開口部の工事、
 * (4)収納設備を増設する工事、(5)開口部・界壁・界床の防音性能を向上させる工事、
 * (6)間仕切壁の位置を変更する工事(子ども用の居室を増設するもの、調理室と洗濯室を
 * 近接させるもの等)の6種類(国税庁タックスアンサーNo.1228)。
 *
 * 計算式(国税庁タックスアンサーNo.1228に基づく):
 *   控除額 = A×10% + B×5%(A・Bそれぞれ100円未満切り捨て)
 *   A = 子育て対応改修工事の標準的な費用の額(補助金等控除後。控除対象限度額
 *       250万円を限度)
 *   B = 次の(1)(2)のいずれか低い金額(1,000万円からAを控除した金額を限度)
 *       (1) 標準的な費用の額のうち控除対象限度額を超える部分 + 併せて行う
 *           増築・改築その他の一定の工事に要した費用の額(補助金等控除後)
 *       (2) 子育て対応改修工事の標準的な費用の額(頭打ち前)
 *
 * **制約:**
 *  - 住民税に相当する控除制度は存在しない(所得税のみの制度。他の住宅特定改修
 *    特別税額控除と同様)。
 *  - この控除はバリアフリー改修・省エネ改修・多世帯同居改修(41条の19の3)・
 *    住宅耐震改修特別控除(41条の19の2)・耐久性向上改修の各控除と選択適用
 *    (いずれか1つのみ)となるほか、併用時のB(増改築等工事費用分)の1,000万円の
 *    限度額の合算判定が必要だが、本ツールは子育て対応改修工事単独での適用を前提とし、
 *    他の改修工事との併用・選択適用の判定は行わない(今後の課題)。
 */

const STANDARD_COST_MINIMUM_JPY = new Decimal(500_000);
const CONTROL_LIMIT_JPY = new Decimal(2_500_000);
const RELATED_WORK_TOTAL_LIMIT_JPY = new Decimal(10_000_000);
const AMOUNT_A_CREDIT_RATE = 0.1;
const AMOUNT_B_CREDIT_RATE = 0.05;

const TOTAL_INCOME_LIMIT_AT_LEAST_50SQM_JPY = new Decimal(20_000_000);
const TOTAL_INCOME_LIMIT_40_TO_50SQM_JPY = new Decimal(10_000_000);

const EARLIEST_SUPPORTED_RESIDENCE_YEAR = 2024;
const LATEST_RESIDENCE_YEAR = 2028;
const FROM_40_TO_50SQM_EARLIEST_RESIDENCE_YEAR = 2026;

export type ChildRearingRenovationFloorAreaCategory = "AT_LEAST_50" | "FROM_40_TO_50";

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

function floorToHundredYen(value: Decimal): Decimal {
  return value.dividedBy(100).floor().times(100);
}

export interface ChildRearingRenovationDeductionInput {
  /** 改修後の住宅に自己の居住の用に供した年(西暦) */
  residenceYear: number;
  /** 床面積区分(50平方メートル以上か、40平方メートル以上50平方メートル未満か) */
  floorAreaCategory: ChildRearingRenovationFloorAreaCategory;
  /** この特別控除を受ける年分の合計所得金額 */
  totalIncomeJpy: Decimal.Value;
  /** 居住年の12月31日時点で19歳未満の扶養親族を有するか */
  hasDependentUnder19: boolean;
  /** 居住年の12月31日時点で配偶者を有するか */
  hasSpouse: boolean;
  /** 居住年の12月31日時点で本人の年齢が40歳未満か(hasSpouseがtrueの場合のみ意味を持つ) */
  taxpayerAgeUnder40: boolean;
  /** 居住年の12月31日時点で配偶者の年齢が40歳未満か(hasSpouseがtrueの場合のみ意味を持つ) */
  spouseAgeUnder40: boolean;
  /** 子どもの事故防止工事(壁の出隅の面取り、床材の切替、手すりの設置等)を行ったか */
  childSafetyWork: boolean;
  /** 対面式キッチンへの取替工事を行ったか */
  openKitchenWork: boolean;
  /** 侵入防止対策を施した開口部の工事を行ったか */
  securityOpeningWork: boolean;
  /** 収納設備を増設する工事を行ったか */
  storageWork: boolean;
  /** 開口部・界壁・界床の防音性能を向上させる工事を行ったか */
  soundproofingWork: boolean;
  /** 間仕切壁の位置を変更する工事(子ども用居室の増設等)を行ったか */
  partitionWallWork: boolean;
  /** 子育て対応改修工事に係る標準的な費用の額(補助金等の額を控除した後の金額) */
  standardCostJpy: Decimal.Value;
  /** 子育て対応改修工事と併せて行う増築・改築その他の一定の工事に要した費用の額(補助金等控除後) */
  otherRelatedWorkCostJpy?: Decimal.Value;
  /** 子育て対応改修工事の日から6か月以内に居住の用に供したか */
  workCompletedWithinSixMonths: boolean;
  /** 工事費用の2分の1以上の額が自己の居住用部分の工事費用か */
  atLeastHalfCostForOwnResidence: boolean;
  /** その年の前年以前3年内の各年分に、同一住宅について子育て対応改修工事に係るこの税額控除の適用を受けたか */
  usedSameCreditInPastThreeYears: boolean;
}

export interface ChildRearingRenovationDeductionResult {
  eligible: boolean;
  ineligibleReason?: string;
  standardCostJpy: Decimal;
  /** 控除対象限度額(250万円) */
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
 * 子育て対応改修工事をした場合の住宅特定改修特別税額控除額を試算する。
 * DBに依存しない純粋関数。
 */
export function estimateChildRearingRenovationDeduction(
  input: ChildRearingRenovationDeductionInput,
): ChildRearingRenovationDeductionResult {
  const standardCostJpy = new Decimal(input.standardCostJpy);
  const totalIncomeJpy = new Decimal(input.totalIncomeJpy);
  const otherRelatedWorkCostJpy = input.otherRelatedWorkCostJpy
    ? new Decimal(input.otherRelatedWorkCostJpy)
    : new Decimal(0);
  requireNonNegative(standardCostJpy, "子育て対応改修工事に係る標準的な費用の額");
  requireNonNegative(totalIncomeJpy, "合計所得金額");
  requireNonNegative(otherRelatedWorkCostJpy, "併せて行う増築・改築その他の一定の工事に要した費用の額");

  const notes: string[] = [
    "租税特別措置法41条の19の3・国税庁タックスアンサーNo.1228に基づく概算値。住民税に相当する控除制度は存在しないため、所得税額からのみ控除する(他の住宅特定改修特別税額控除と同様)。",
    "バリアフリー改修・省エネ改修・住宅耐震改修特別控除・多世帯同居改修・耐久性向上改修の各控除といずれか1つの選択適用となるほか、併用時のB(増改築等工事費用分)の1,000万円の限度額は各改修工事のAの合計額を控除した額が限度になるが、本ツールは子育て対応改修工事単独での適用を前提とし、他の改修工事との選択適用・併用時の限度額の合算判定は行わない(今後の課題)。",
  ];

  function ineligible(reason: string): ChildRearingRenovationDeductionResult {
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
      "この控除は令和6年度税制改正で新設された制度で、令和6年(2024年)4月1日から令和10年(2028年)12月31日までの間に自己の居住の用に供した場合のみ対象。",
    );
  }
  if (input.residenceYear > LATEST_RESIDENCE_YEAR) {
    return ineligible(
      "適用期限(令和10年(2028年)12月31日までに居住の用に供したもの)を過ぎているため対象外(延長の可能性があるため国税庁の最新情報を確認すること)。",
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

  const isEligibleIndividual =
    input.hasDependentUnder19 ||
    (input.hasSpouse && (input.taxpayerAgeUnder40 || input.spouseAgeUnder40));
  if (!isEligibleIndividual) {
    return ineligible(
      "この控除の対象者(特例対象個人)は、居住年の12月31日時点で19歳未満の扶養親族を有する者、または年齢40歳未満で配偶者を有する者もしくは年齢40歳以上で年齢40歳未満の配偶者を有する者に限られる。",
    );
  }

  const hasQualifyingWork =
    input.childSafetyWork ||
    input.openKitchenWork ||
    input.securityOpeningWork ||
    input.storageWork ||
    input.soundproofingWork ||
    input.partitionWallWork;
  if (!hasQualifyingWork) {
    return ineligible(
      "子どもの事故防止工事・対面式キッチンへの取替工事・侵入防止対策を施した開口部の工事・収納設備の増設工事・防音性能を向上させる工事・間仕切壁の位置を変更する工事のうち、いずれか1つ以上に該当する工事であることが要件。",
    );
  }

  const totalIncomeLimitJpy =
    input.floorAreaCategory === "FROM_40_TO_50"
      ? TOTAL_INCOME_LIMIT_40_TO_50SQM_JPY
      : TOTAL_INCOME_LIMIT_AT_LEAST_50SQM_JPY;
  if (totalIncomeJpy.greaterThan(totalIncomeLimitJpy)) {
    return ineligible(
      `合計所得金額がこの特別控除を受けるための上限(${totalIncomeLimitJpy.toString()}円)を超えるため対象外。`,
    );
  }

  if (standardCostJpy.lessThanOrEqualTo(STANDARD_COST_MINIMUM_JPY)) {
    return ineligible(
      "子育て対応改修工事に係る標準的な費用の額(補助金等控除後)が50万円を超えることが要件。",
    );
  }
  if (!input.workCompletedWithinSixMonths) {
    return ineligible("子育て対応改修工事の日から6か月以内に居住の用に供していることが要件。");
  }
  if (!input.atLeastHalfCostForOwnResidence) {
    return ineligible("工事費用の2分の1以上の額が自己の居住用部分の工事費用であることが要件。");
  }
  if (input.usedSameCreditInPastThreeYears) {
    return ineligible(
      "その年の前年以前3年内の各年分において、同一の住宅について子育て対応改修工事に係るこの税額控除を適用した場合、重ねて適用することはできない。",
    );
  }

  const amountAJpy = Decimal.min(standardCostJpy, CONTROL_LIMIT_JPY);
  const excessOverLimitJpy = Decimal.max(standardCostJpy.minus(CONTROL_LIMIT_JPY), 0);
  const amountBCandidate1Jpy = excessOverLimitJpy.plus(otherRelatedWorkCostJpy);
  const amountBCandidate2Jpy = standardCostJpy;
  const amountBBeforeCapJpy = Decimal.min(amountBCandidate1Jpy, amountBCandidate2Jpy);
  const amountBLimitJpy = Decimal.max(RELATED_WORK_TOTAL_LIMIT_JPY.minus(amountAJpy), 0);
  const amountBJpy = Decimal.min(amountBBeforeCapJpy, amountBLimitJpy);

  const creditJpy = floorToHundredYen(amountAJpy.times(AMOUNT_A_CREDIT_RATE)).plus(
    floorToHundredYen(amountBJpy.times(AMOUNT_B_CREDIT_RATE)),
  );

  if (standardCostJpy.greaterThan(CONTROL_LIMIT_JPY)) {
    notes.push(
      `子育て対応改修工事に係る標準的な費用の額が控除対象限度額(${CONTROL_LIMIT_JPY.toString()}円)を超えるため、超過分は増築・改築その他の一定の工事に要した費用の額と合わせてB(5%控除)の対象とした。`,
    );
  }
  if (amountBBeforeCapJpy.greaterThan(amountBLimitJpy)) {
    notes.push("B(5%控除の対象額)が1,000万円からAを控除した限度額を超えるため頭打ちにした。");
  }

  return {
    eligible: true,
    standardCostJpy,
    controlLimitJpy: CONTROL_LIMIT_JPY,
    amountAJpy,
    amountBJpy,
    creditJpy,
    notes,
  };
}

export interface ChildRearingRenovationDeductionRecordEntry {
  taxYear: number;
  /** その年分の控除額(所得税分。ChildRearingRenovationDeductionResult.creditJpy) */
  creditJpy: Decimal;
}

/**
 * `/child-rearing-renovation-deduction`で登録済みの、指定した年分の子育て対応改修
 * 住宅特定改修特別税額控除額をDBから読み出す。他の住宅特定改修特別税額控除と同様、
 * 下書きCSV(`/api/export`)の税額控除欄・`/tax-estimate`の合計税額試算への
 * 自動反映に使う。未登録の年は null を返す。
 */
export async function getChildRearingRenovationDeductionRecord(
  year: number,
): Promise<ChildRearingRenovationDeductionRecordEntry | null> {
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (!taxYear) return null;

  const record = await prisma.childRearingRenovationDeductionRecord.findUnique({
    where: { taxYearId: taxYear.id },
  });
  if (!record) return null;

  return {
    taxYear: year,
    creditJpy: new Decimal(record.creditJpy.toString()),
  };
}
