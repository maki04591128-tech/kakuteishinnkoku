import { Decimal } from "decimal.js";
import { earthquakeRenovationDeductionRecordRepository } from "@/lib/repositories/defaultEarthquakeRenovationDeductionRecordRepository";
import { taxYearRepository } from "@/lib/repositories/defaultTaxYearRepository";

/**
 * 住宅耐震改修特別控除(税額控除。租税特別措置法41条の19の2)。
 *
 * 自己の居住の用に供する家屋で、昭和56年5月31日以前に建築されたもの
 * (現行の耐震基準に適合しないもの)について、現行の耐震基準に適合させる
 * 耐震改修を行った場合に、その年分の所得税額から控除できる制度。住宅ローン控除
 * (`mortgageDeduction.ts`)や(特定増改築等)住宅借入金等特別控除とは異なり、
 * 借入金の有無を問わず(ローンを組まず自己資金で改修した場合も対象)、
 * 単年で完結する控除で繰越制度は無い。
 *
 * 計算式(国税庁タックスアンサーNo.1222(令和8年4月1日現在法令等)・租税特別措置法
 * 41条の19の2に基づく。ページ本文を直接確認した):
 *   控除額 = A×10% + B×5%(A・Bそれぞれ100円未満切り捨て)
 *   A = 住宅耐震改修に係る耐震工事の標準的な費用の額(補助金等控除後。控除対象
 *       限度額250万円を限度)
 *   B = 次の(1)(2)のいずれか低い金額(1,000万円からAを控除した金額を限度)
 *       (1) 標準的な費用の額のうち控除対象限度額を超える部分 + 併せて行う
 *           増築・改築その他の一定の工事に要した費用の額(補助金等控除後)
 *       (2) 住宅耐震改修に係る耐震工事の標準的な費用の額(頭打ち前)
 * Bの適用を受けるには、自己が所有する家屋であり、かつその年分の合計所得金額が
 * 2,000万円以下(令和4年1月1日から令和5年12月31日までの間に居住の用に供した
 * 場合の経過措置は3,000万円以下)であることが必要(No.1222注3)。また、令和3年
 * 12月31日以前に耐震改修をした場合、または耐震工事と併せて行う増改築等について
 * この特別控除と住宅借入金等特別控除の両方の適用を受ける場合は、Aに対する控除額
 * のみとなりBは適用されない(No.1222注)。
 *
 * 標準的な工事費用相当額は、耐震改修の内容に応じて政令で定められた単価表に
 * 基づき算出される金額で、実際の工事費用そのものではない(実際の工事費用の方が
 * 少ない場合はその実額)。本ツールはこの単価表を持たないため、耐震改修
 * 促進税制の証明書(地方公共団体・指定確認検査機関・登録住宅性能評価機関・
 * 住宅瑕疵担保責任保険法人が発行する増改築等工事証明書)に記載された
 * 標準的な工事費用相当額をそのまま入力する前提とする。
 *
 * (機能149で、以前はA(標準的な費用の額を250万円で頭打ちした部分)のみを控除対象と
 * しBを一切計算していなかった実装上の誤りを修正した。国税庁タックスアンサーNo.1222の
 * 本文を直接確認したところ、標準的な費用の額が250万円を超える場合、その超過分単独
 * でも(併せて行う増改築等工事が無くても)Bとして5%控除の対象になることが明記されて
 * いた。)
 *
 * **制約:**
 *  - 住民税に相当する控除制度は存在しない(所得税のみの制度)。地方税法上、
 *    住宅借入金等特別税額控除のような住民税への振替制度は無いことを、
 *    複数の独立した情報源(税理士法人の解説記事・自治体の案内ページ)で確認した。
 *  - 適用期限(令和10年(2028年)12月31日までの改修が対象。過去に複数回
 *    延長されており、延長前の情報源では令和5年12月31日までと案内している
 *    ものも残っているため、実際の適用可否は国税庁の最新情報で確認すること)・
 *    対象家屋が耐震改修促進法に基づく耐震改修であるかの判定はユーザー自身が
 *    行う前提とする。令和3年12月31日以前に耐震改修をした場合にBが適用されない点は
 *    `beforeReiwa4`で扱うが、その場合の控除対象限度額が消費税率により200万円/
 *    250万円に分かれる点は本ツールでは判定しない(今後の課題)。
 *  - バリアフリー改修・多世帯同居改修・耐久性向上改修・子育て対応改修に対応する
 *    住宅特定改修特別税額控除(措置法41条の19の3)や、認定住宅等新築等特別税額控除
 *    (投資型減税。措置法41条の19の4)は別制度。ただしNo.1222注4により、Bの1,000万円の
 *    限度額はこれら5類型とも合算して判定する必要があり、この合算判定は
 *    `renovationCreditCombination.ts`(機能149。`/renovation-credit-combination`)で
 *    別途試算できる。省エネ改修工事分は`energySavingRenovationDeduction.ts`、
 *    認定住宅等新築等特別税額控除は`certifiedHousingConstructionCredit.ts`で
 *    それぞれ対応済み。
 */

const CONTROL_LIMIT_JPY = new Decimal(2_500_000);
const RELATED_WORK_TOTAL_LIMIT_JPY = new Decimal(10_000_000);
const AMOUNT_A_CREDIT_RATE = 0.1;
const AMOUNT_B_CREDIT_RATE = 0.05;
const B_TOTAL_INCOME_LIMIT_JPY = new Decimal(20_000_000);
const B_TOTAL_INCOME_LIMIT_TRANSITIONAL_JPY = new Decimal(30_000_000);

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

function floorToHundredYen(value: Decimal): Decimal {
  return value.dividedBy(100).floor().times(100);
}

export interface EarthquakeRenovationDeductionInput {
  /** 耐震改修に係る標準的な工事費用相当額(補助金等の額を控除した後の金額) */
  standardCostJpy: Decimal.Value;
  /**
   * 耐震工事と併せて行う増築・改築その他の一定の工事に要した費用の額
   * (補助金等控除後。未入力の場合は0)。Bの計算に用いる。
   */
  otherRelatedWorkCostJpy?: Decimal.Value;
  /**
   * この特別控除を受ける年分の合計所得金額。Bの適用要件(2,000万円以下、
   * 令和4年〜5年居住の場合は3,000万円以下)の判定に用いる。未入力の場合は
   * 上限を満たすものとみなしてBを計算する(その旨を注記する)。
   */
  totalIncomeJpy?: Decimal.Value | null;
  /**
   * 自己が所有する家屋か(Bの適用要件)。未入力の場合はtrue(所有している)とみなす。
   */
  ownsHouse?: boolean;
  /**
   * 令和4年1月1日から令和5年12月31日までの間に自己の居住の用に供したか。
   * trueの場合、Bの合計所得金額の上限が2,000万円ではなく3,000万円になる経過措置。
   */
  residenceIn2022Or2023?: boolean;
  /**
   * 令和3年12月31日以前に耐震改修をしたか。trueの場合Bは適用されずAのみになる
   * (No.1222注)。
   */
  beforeReiwa4?: boolean;
  /**
   * 耐震工事と併せて行う増改築等について、この特別控除と住宅借入金等特別控除の
   * 両方の適用を受けるか。trueの場合Bは適用されずAのみになる(No.1222注)。
   */
  claimsMortgageDeductionForRelatedWork?: boolean;
}

export interface EarthquakeRenovationDeductionResult {
  standardCostJpy: Decimal;
  /** 控除額の計算基準額(標準的な工事費用相当額を250万円で頭打ちした金額。A) */
  cappedStandardCostJpy: Decimal;
  /** Aと同じ値(他の住宅特定改修特別税額控除モジュールとの命名を揃えたエイリアス) */
  amountAJpy: Decimal;
  /** 標準的な費用の額のうち控除対象限度額(250万円)を超える部分 */
  excessOverControlLimitJpy: Decimal;
  otherRelatedWorkCostJpy: Decimal;
  /** Bの適用要件(所有・合計所得金額・経過措置の除外事由)を満たすか */
  bEligible: boolean;
  /** B(5%控除の対象額)。bEligibleがfalseの場合は0 */
  amountBJpy: Decimal;
  /** 控除額(所得税分のみ。A・Bそれぞれ100円未満切り捨て) */
  creditJpy: Decimal;
  notes: string[];
}

/**
 * 住宅耐震改修特別控除額を試算する。DBに依存しない純粋関数。
 */
export function estimateEarthquakeRenovationDeduction(
  input: EarthquakeRenovationDeductionInput,
): EarthquakeRenovationDeductionResult {
  const standardCostJpy = new Decimal(input.standardCostJpy);
  requireNonNegative(standardCostJpy, "耐震改修に係る標準的な工事費用相当額");

  const otherRelatedWorkCostJpy = input.otherRelatedWorkCostJpy
    ? new Decimal(input.otherRelatedWorkCostJpy)
    : new Decimal(0);
  requireNonNegative(otherRelatedWorkCostJpy, "耐震工事と併せて行う増改築等工事費用の額");

  const totalIncomeJpy =
    input.totalIncomeJpy === undefined || input.totalIncomeJpy === null
      ? null
      : new Decimal(input.totalIncomeJpy);
  if (totalIncomeJpy !== null) {
    requireNonNegative(totalIncomeJpy, "合計所得金額");
  }

  const ownsHouse = input.ownsHouse ?? true;
  const residenceIn2022Or2023 = input.residenceIn2022Or2023 ?? false;
  const beforeReiwa4 = input.beforeReiwa4 ?? false;
  const claimsMortgageDeductionForRelatedWork = input.claimsMortgageDeductionForRelatedWork ?? false;

  const cappedStandardCostJpy = Decimal.min(standardCostJpy, CONTROL_LIMIT_JPY);
  const amountAJpy = cappedStandardCostJpy;
  const excessOverControlLimitJpy = Decimal.max(standardCostJpy.minus(amountAJpy), 0);

  const notes: string[] = [
    "国税庁タックスアンサーNo.1222・租税特別措置法41条の19の2に基づく概算値。住民税に相当する控除制度は存在しないため、所得税額からのみ控除する(住宅ローン控除のような住民税への振替は無い)。",
    "対象は自己の居住の用に供する家屋で昭和56年5月31日以前に建築されたもの(現行の耐震基準に適合しないもの)に限られ、改修後は現行の耐震基準に適合させる耐震改修であることが必要。適用可否・対象工事の該当性はユーザー自身で確認すること。",
  ];
  if (standardCostJpy.greaterThan(CONTROL_LIMIT_JPY)) {
    notes.push(
      "耐震改修に係る標準的な工事費用相当額が250万円を超えるため、Aの計算上は250万円で頭打ちにした(超過分はBとして5%控除の対象とする)。",
    );
  }

  let bEligible = true;
  if (beforeReiwa4) {
    bEligible = false;
    notes.push("令和3年12月31日以前に耐震改修をした場合はBが適用されずAのみの控除となる。");
  } else if (claimsMortgageDeductionForRelatedWork) {
    bEligible = false;
    notes.push(
      "耐震工事と併せて行う増改築等についてこの特別控除と住宅借入金等特別控除の両方の適用を受ける場合はBが適用されずAのみの控除となる。",
    );
  } else if (!ownsHouse) {
    bEligible = false;
    notes.push("Bの適用には自己が所有する家屋であることが要件のため、Bは適用されない。");
  } else {
    const bIncomeLimitJpy = residenceIn2022Or2023
      ? B_TOTAL_INCOME_LIMIT_TRANSITIONAL_JPY
      : B_TOTAL_INCOME_LIMIT_JPY;
    if (totalIncomeJpy !== null && totalIncomeJpy.greaterThan(bIncomeLimitJpy)) {
      bEligible = false;
      notes.push(
        `Bの適用にはこの特別控除を受ける年分の合計所得金額が${bIncomeLimitJpy.toString()}円以下であることが要件だが、これを超えるためBは適用されない(Aのみの控除)。`,
      );
    } else if (totalIncomeJpy === null) {
      notes.push(
        `Bの適用要件(合計所得金額が${bIncomeLimitJpy.toString()}円以下)を入力していないため、要件を満たすものとみなしてBを計算した。実際の合計所得金額を確認すること。`,
      );
    }
  }

  const candidate1Jpy = excessOverControlLimitJpy.plus(otherRelatedWorkCostJpy);
  const candidate2Jpy = standardCostJpy;
  const amountBBeforeCapJpy = Decimal.min(candidate1Jpy, candidate2Jpy);
  const amountBLimitJpy = Decimal.max(RELATED_WORK_TOTAL_LIMIT_JPY.minus(amountAJpy), 0);
  const amountBJpy = bEligible ? Decimal.min(amountBBeforeCapJpy, amountBLimitJpy) : new Decimal(0);

  if (bEligible && amountBBeforeCapJpy.greaterThan(amountBLimitJpy)) {
    notes.push("Bが1,000万円からAを控除した限度額を超えるため頭打ちにした。");
  }

  const creditJpy = floorToHundredYen(amountAJpy.times(AMOUNT_A_CREDIT_RATE)).plus(
    floorToHundredYen(amountBJpy.times(AMOUNT_B_CREDIT_RATE)),
  );

  return {
    standardCostJpy,
    cappedStandardCostJpy,
    amountAJpy,
    excessOverControlLimitJpy,
    otherRelatedWorkCostJpy,
    bEligible,
    amountBJpy,
    creditJpy,
    notes,
  };
}

export interface EarthquakeRenovationDeductionRecordEntry {
  taxYear: number;
  /** その年分の控除額(所得税分。EarthquakeRenovationDeductionResult.creditJpy) */
  creditJpy: Decimal;
}

/**
 * `/earthquake-renovation-deduction`で登録済みの、指定した年分の住宅耐震改修
 * 特別控除額をDBから読み出す。分配時調整外国税相当額控除等と同様、下書きCSV
 * (`/api/export`)の税額控除欄・`/tax-estimate`の合計税額試算への自動反映に使う。
 * 未登録の年は null を返す。
 */
export async function getEarthquakeRenovationDeductionRecord(
  year: number,
): Promise<EarthquakeRenovationDeductionRecordEntry | null> {
  const taxYear = await taxYearRepository.findByYear(year);
  if (!taxYear) return null;

  const record = await earthquakeRenovationDeductionRecordRepository.findByTaxYearId(
    taxYear.id,
  );
  if (!record) return null;

  return {
    taxYear: year,
    creditJpy: new Decimal(record.creditJpy.toString()),
  };
}
