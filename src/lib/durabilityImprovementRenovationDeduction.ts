import { Decimal } from "decimal.js";
import { prisma } from "./db";

/**
 * 耐久性向上改修工事をした場合の住宅特定改修特別税額控除(税額控除。租税特別措置法
 * 41条の19の3。国税庁タックスアンサーNo.1227)。
 *
 * 省エネ改修工事(`energySavingRenovationDeduction.ts`)・バリアフリー改修工事
 * (`barrierFreeRenovationDeduction.ts`)・多世帯同居改修工事
 * (`multiHouseholdRenovationDeduction.ts`)の3制度と異なり、耐久性向上改修工事は
 * 単独では適用できず、必ず住宅耐震改修(`earthquakeRenovationDeduction.ts`)または
 * 一般省エネ改修工事のいずれか(または両方)と併せて行うことが要件になる
 * (国税庁タックスアンサーNo.1227)。耐久性向上改修工事とは、小屋裏・外壁・浴室・
 * 脱衣室・土台・軸組等・床下・基礎もしくは地盤に関する劣化対策工事または
 * 給排水管もしくは給湯管に関する維持管理・更新を容易にするための工事で、認定を
 * 受けた長期優良住宅建築等計画に基づくものであること等一定の要件を満たすもの。
 *
 * 平成29年(2017年)4月1日から令和10年(2028年)12月31日までの間に自己の居住の用に
 * 供した場合に、借入金の有無を問わずその年分の所得税額から控除できる。単年で
 * 完結する控除で繰越制度は無い。
 *
 * 計算式(国税庁タックスアンサーNo.1227に基づく):
 *   控除額 = A×10% + B×5%(A・Bそれぞれ100円未満切り捨て)
 *   A = 併せて行う住宅耐震改修・一般省エネ改修工事・耐久性向上改修工事それぞれの
 *       標準的な費用の額(補助金等控除後)の合計額(控除対象限度額を限度。組み合わせ
 *       により250万円/350万円/500万円/600万円)
 *   B = 次の(1)(2)のいずれか低い金額(1,000万円からAを控除した金額を限度)
 *       (1) 上記合計額のうち控除対象限度額を超える部分 + 併せて行う増築・改築
 *           その他の一定の工事に要した費用の額(補助金等控除後)
 *       (2) 上記合計額(頭打ち前)
 *
 * **制約:**
 *  - 住民税に相当する控除制度は存在しない(所得税のみの制度。他の住宅特定改修
 *    特別税額控除と同様)。
 *  - 令和4年(2022年)1月1日より前に居住の用に供した場合は、バリアフリー改修工事・
 *    省エネ改修工事・多世帯同居改修工事と同様に控除対象限度額が工事費用に含まれる
 *    消費税率(8%・10%)により異なる場合があるなど算式・要件が異なり、本ツールは
 *    この古い制度のケースを判定するための情報を持たないため対象外とする(今後の課題)。
 *  - この控除はバリアフリー改修・省エネ改修・多世帯同居改修(41条の19の3)・
 *    住宅耐震改修特別控除(41条の19の2)・子育て対応改修の各控除と選択適用
 *    (いずれか1つのみ)となるほか、併用時のB(増改築等工事費用分)の1,000万円の
 *    限度額の合算判定が必要だが、本ツールは耐久性向上改修工事(+併せて行う耐震
 *    改修・省エネ改修工事)単独での適用を前提とし、子育て対応改修等その他の改修
 *    工事との併用・選択適用の判定は行わない(今後の課題)。
 */

const DURABILITY_STANDARD_COST_MINIMUM_JPY = new Decimal(500_000);
const COMBINED_BASE_WORK_STANDARD_COST_MINIMUM_JPY = new Decimal(500_000);
const RELATED_WORK_TOTAL_LIMIT_JPY = new Decimal(10_000_000);
const AMOUNT_A_CREDIT_RATE = 0.1;
const AMOUNT_B_CREDIT_RATE = 0.05;

const CONTROL_LIMIT_EARTHQUAKE_JPY = new Decimal(2_500_000);
const CONTROL_LIMIT_ENERGY_SAVING_JPY = new Decimal(2_500_000);
const CONTROL_LIMIT_ENERGY_SAVING_WITH_SOLAR_JPY = new Decimal(3_500_000);
const CONTROL_LIMIT_BOTH_JPY = new Decimal(5_000_000);
const CONTROL_LIMIT_BOTH_WITH_SOLAR_JPY = new Decimal(6_000_000);

const TOTAL_INCOME_LIMIT_AT_LEAST_50SQM_BEFORE_2024_JPY = new Decimal(30_000_000);
const TOTAL_INCOME_LIMIT_AT_LEAST_50SQM_FROM_2024_JPY = new Decimal(20_000_000);
const TOTAL_INCOME_LIMIT_40_TO_50SQM_JPY = new Decimal(10_000_000);

const EARLIEST_SUPPORTED_RESIDENCE_YEAR = 2022;
const LATEST_RESIDENCE_YEAR = 2028;
const FROM_40_TO_50SQM_EARLIEST_RESIDENCE_YEAR = 2026;

export type DurabilityImprovementRenovationCombinationType =
  | "EARTHQUAKE"
  | "ENERGY_SAVING"
  | "BOTH";

export type DurabilityImprovementRenovationFloorAreaCategory = "AT_LEAST_50" | "FROM_40_TO_50";

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

function floorToHundredYen(value: Decimal): Decimal {
  return value.dividedBy(100).floor().times(100);
}

export interface DurabilityImprovementRenovationDeductionInput {
  /** 改修後の住宅に自己の居住の用に供した年(西暦) */
  residenceYear: number;
  /** 併せて行う工事の組み合わせ(住宅耐震改修/一般省エネ改修工事/両方) */
  combinationType: DurabilityImprovementRenovationCombinationType;
  /** 床面積区分(50平方メートル以上か、40平方メートル以上50平方メートル未満か) */
  floorAreaCategory: DurabilityImprovementRenovationFloorAreaCategory;
  /** この特別控除を受ける年分の合計所得金額 */
  totalIncomeJpy: Decimal.Value;
  /** 併せて行う一般省エネ改修工事に太陽光発電設備設置工事を含むか(ENERGY_SAVING/BOTHのみ意味を持つ) */
  includesSolarPowerEquipment: boolean;
  /** 住宅耐震改修工事に係る標準的な費用の額(補助金等控除後。EARTHQUAKE/BOTHで必須) */
  earthquakeRenovationStandardCostJpy?: Decimal.Value;
  /** 一般省エネ改修工事に係る標準的な費用の額(補助金等控除後。ENERGY_SAVING/BOTHで必須) */
  energySavingRenovationStandardCostJpy?: Decimal.Value;
  /** 耐久性向上改修工事に係る標準的な費用の額(補助金等控除後) */
  durabilityImprovementStandardCostJpy: Decimal.Value;
  /** 併せて行う増築・改築その他の一定の工事に要した費用の額(補助金等控除後) */
  otherRelatedWorkCostJpy?: Decimal.Value;
  /** 工事の日から6か月以内に居住の用に供したか */
  workCompletedWithinSixMonths: boolean;
  /** 工事費用の2分の1以上の額が自己の居住用部分の工事費用か */
  atLeastHalfCostForOwnResidence: boolean;
  /** その年の前年以前3年内の各年分に、同一住宅についてこの税額控除(耐久性向上改修工事分)の適用を受けたか */
  usedSameCreditInPastThreeYears: boolean;
  /**
   * ENERGY_SAVING/BOTHの場合のみ意味を持つ。その年の前年以前3年内の各年分に、
   * 同一住宅について一般省エネ改修工事単独の住宅特定改修特別税額控除
   * (機能82・energySavingRenovationDeduction.ts)の適用を受けたか。
   * 受けている場合はこの年分の耐久性向上改修工事分は適用できない
   * (国税庁タックスアンサーNo.1227の(注))。
   */
  claimedEnergySavingAloneInPastThreeYears?: boolean;
}

export interface DurabilityImprovementRenovationDeductionResult {
  eligible: boolean;
  ineligibleReason?: string;
  /** 住宅耐震改修・一般省エネ改修工事・耐久性向上改修工事の標準的な費用の額の合計(頭打ち前) */
  combinedStandardCostJpy: Decimal;
  /** 控除対象限度額(組み合わせにより250万円/350万円/500万円/600万円) */
  controlLimitJpy: Decimal;
  /** A: 標準的な費用の額の合計のうち控除対象限度額までの部分(10%控除) */
  amountAJpy: Decimal;
  /** B: 控除対象限度額超過分+関連工事費用(1,000万円からAを控除した額を限度。5%控除) */
  amountBJpy: Decimal;
  /** 控除額(所得税分のみ。A・Bそれぞれ100円未満切り捨て) */
  creditJpy: Decimal;
  notes: string[];
}

/**
 * 耐久性向上改修工事をした場合の住宅特定改修特別税額控除額を試算する。
 * DBに依存しない純粋関数。
 */
export function estimateDurabilityImprovementRenovationDeduction(
  input: DurabilityImprovementRenovationDeductionInput,
): DurabilityImprovementRenovationDeductionResult {
  const totalIncomeJpy = new Decimal(input.totalIncomeJpy);
  const earthquakeRenovationStandardCostJpy = input.earthquakeRenovationStandardCostJpy
    ? new Decimal(input.earthquakeRenovationStandardCostJpy)
    : new Decimal(0);
  const energySavingRenovationStandardCostJpy = input.energySavingRenovationStandardCostJpy
    ? new Decimal(input.energySavingRenovationStandardCostJpy)
    : new Decimal(0);
  const durabilityImprovementStandardCostJpy = new Decimal(
    input.durabilityImprovementStandardCostJpy,
  );
  const otherRelatedWorkCostJpy = input.otherRelatedWorkCostJpy
    ? new Decimal(input.otherRelatedWorkCostJpy)
    : new Decimal(0);

  requireNonNegative(totalIncomeJpy, "合計所得金額");
  requireNonNegative(earthquakeRenovationStandardCostJpy, "住宅耐震改修工事に係る標準的な費用の額");
  requireNonNegative(
    energySavingRenovationStandardCostJpy,
    "一般省エネ改修工事に係る標準的な費用の額",
  );
  requireNonNegative(
    durabilityImprovementStandardCostJpy,
    "耐久性向上改修工事に係る標準的な費用の額",
  );
  requireNonNegative(otherRelatedWorkCostJpy, "併せて行う増築・改築その他の一定の工事に要した費用の額");

  const usesEarthquake = input.combinationType === "EARTHQUAKE" || input.combinationType === "BOTH";
  const usesEnergySaving =
    input.combinationType === "ENERGY_SAVING" || input.combinationType === "BOTH";

  const controlLimitJpy =
    input.combinationType === "EARTHQUAKE"
      ? CONTROL_LIMIT_EARTHQUAKE_JPY
      : input.combinationType === "ENERGY_SAVING"
        ? input.includesSolarPowerEquipment
          ? CONTROL_LIMIT_ENERGY_SAVING_WITH_SOLAR_JPY
          : CONTROL_LIMIT_ENERGY_SAVING_JPY
        : input.includesSolarPowerEquipment
          ? CONTROL_LIMIT_BOTH_WITH_SOLAR_JPY
          : CONTROL_LIMIT_BOTH_JPY;

  const baseWorkStandardCostJpy = (usesEarthquake ? earthquakeRenovationStandardCostJpy : new Decimal(0)).plus(
    usesEnergySaving ? energySavingRenovationStandardCostJpy : new Decimal(0),
  );
  const combinedStandardCostJpy = baseWorkStandardCostJpy.plus(durabilityImprovementStandardCostJpy);

  const notes: string[] = [
    "租税特別措置法41条の19の3・国税庁タックスアンサーNo.1227に基づく概算値。住民税に相当する控除制度は存在しないため、所得税額からのみ控除する(他の住宅特定改修特別税額控除と同様)。",
    "バリアフリー改修・省エネ改修・多世帯同居改修・住宅耐震改修特別控除・子育て対応改修の各控除といずれか1つの選択適用となるほか、併用時のB(増改築等工事費用分)の1,000万円の限度額は各改修工事のAの合計額を控除した額が限度になるが、本ツールは耐久性向上改修工事(+併せて行う耐震改修・省エネ改修工事)単独での適用を前提とし、子育て対応改修等その他の改修工事との選択適用・併用時の限度額の合算判定は行わない(今後の課題)。",
  ];

  function ineligible(reason: string): DurabilityImprovementRenovationDeductionResult {
    return {
      eligible: false,
      ineligibleReason: reason,
      combinedStandardCostJpy,
      controlLimitJpy: new Decimal(0),
      amountAJpy: new Decimal(0),
      amountBJpy: new Decimal(0),
      creditJpy: new Decimal(0),
      notes,
    };
  }

  if (input.residenceYear < EARLIEST_SUPPORTED_RESIDENCE_YEAR) {
    return ineligible(
      "令和4年(2022年)より前に居住の用に供した場合は控除対象限度額の判定(工事費用に含まれる消費税率による区分等)が異なり、本ツールでは試算対象外とする。",
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

  if (usesEarthquake && earthquakeRenovationStandardCostJpy.isZero()) {
    return ineligible(
      "住宅耐震改修を併せて行う場合は、住宅耐震改修工事に係る標準的な費用の額の入力が必要。",
    );
  }
  if (usesEnergySaving && energySavingRenovationStandardCostJpy.isZero()) {
    return ineligible(
      "一般省エネ改修工事を併せて行う場合は、一般省エネ改修工事に係る標準的な費用の額の入力が必要。",
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

  if (baseWorkStandardCostJpy.lessThanOrEqualTo(COMBINED_BASE_WORK_STANDARD_COST_MINIMUM_JPY)) {
    return ineligible(
      "補助金等の額を差し引いた標準的な費用の額が50万円を超える住宅耐震改修または(および)一般省エネ改修工事を併せて行うことが要件。",
    );
  }
  if (
    durabilityImprovementStandardCostJpy.lessThanOrEqualTo(DURABILITY_STANDARD_COST_MINIMUM_JPY)
  ) {
    return ineligible("耐久性向上改修工事に係る標準的な費用の額(補助金等控除後)が50万円を超えることが要件。");
  }
  if (!input.workCompletedWithinSixMonths) {
    return ineligible("工事の日から6か月以内に居住の用に供していることが要件。");
  }
  if (!input.atLeastHalfCostForOwnResidence) {
    return ineligible("工事費用の2分の1以上の額が自己の居住用部分の工事費用であることが要件。");
  }
  if (input.usedSameCreditInPastThreeYears) {
    return ineligible(
      "その年の前年以前3年内の各年分において、同一の住宅について耐久性向上改修工事に係るこの税額控除を適用した場合、重ねて適用することはできない。",
    );
  }
  if (usesEnergySaving && input.claimedEnergySavingAloneInPastThreeYears) {
    return ineligible(
      "一般省エネ改修工事と併せて耐久性向上改修工事を行う場合、その年の前年以前3年内の各年分において同一の住宅について一般省エネ改修工事単独の住宅特定改修特別税額控除を適用しているときは、当該年分において適用することはできない(国税庁タックスアンサーNo.1227の(注))。",
    );
  }

  const amountAJpy = Decimal.min(combinedStandardCostJpy, controlLimitJpy);
  const excessOverLimitJpy = Decimal.max(combinedStandardCostJpy.minus(controlLimitJpy), 0);
  const amountBCandidate1Jpy = excessOverLimitJpy.plus(otherRelatedWorkCostJpy);
  const amountBCandidate2Jpy = combinedStandardCostJpy;
  const amountBBeforeCapJpy = Decimal.min(amountBCandidate1Jpy, amountBCandidate2Jpy);
  const amountBLimitJpy = Decimal.max(RELATED_WORK_TOTAL_LIMIT_JPY.minus(amountAJpy), 0);
  const amountBJpy = Decimal.min(amountBBeforeCapJpy, amountBLimitJpy);

  const creditJpy = floorToHundredYen(amountAJpy.times(AMOUNT_A_CREDIT_RATE)).plus(
    floorToHundredYen(amountBJpy.times(AMOUNT_B_CREDIT_RATE)),
  );

  if (combinedStandardCostJpy.greaterThan(controlLimitJpy)) {
    notes.push(
      `住宅耐震改修・一般省エネ改修工事・耐久性向上改修工事の標準的な費用の額の合計が控除対象限度額(${controlLimitJpy.toString()}円)を超えるため、超過分は増築・改築その他の一定の工事に要した費用の額と合わせてB(5%控除)の対象とした。`,
    );
  }
  if (amountBBeforeCapJpy.greaterThan(amountBLimitJpy)) {
    notes.push("B(5%控除の対象額)が1,000万円からAを控除した限度額を超えるため頭打ちにした。");
  }

  return {
    eligible: true,
    combinedStandardCostJpy,
    controlLimitJpy,
    amountAJpy,
    amountBJpy,
    creditJpy,
    notes,
  };
}

export interface DurabilityImprovementRenovationDeductionRecordEntry {
  taxYear: number;
  /** その年分の控除額(所得税分。DurabilityImprovementRenovationDeductionResult.creditJpy) */
  creditJpy: Decimal;
}

/**
 * `/durability-improvement-renovation-deduction`で登録済みの、指定した年分の
 * 耐久性向上改修工事の住宅特定改修特別税額控除額をDBから読み出す。他の住宅特定改修
 * 特別税額控除と同様、下書きCSV(`/api/export`)の税額控除欄・`/tax-estimate`の
 * 合計税額試算への自動反映に使う。未登録の年は null を返す。
 */
export async function getDurabilityImprovementRenovationDeductionRecord(
  year: number,
): Promise<DurabilityImprovementRenovationDeductionRecordEntry | null> {
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (!taxYear) return null;

  const record = await prisma.durabilityImprovementRenovationDeductionRecord.findUnique({
    where: { taxYearId: taxYear.id },
  });
  if (!record) return null;

  return {
    taxYear: year,
    creditJpy: new Decimal(record.creditJpy.toString()),
  };
}
