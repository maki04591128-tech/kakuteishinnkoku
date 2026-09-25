import { Decimal } from "decimal.js";
import { prisma } from "./db";

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
 * 計算式(国税庁タックスアンサーNo.1222・租税特別措置法41条の19の2に基づく):
 *   控除額 = 耐震改修に係る標準的な工事費用相当額(国又は地方公共団体からの
 *     補助金等の額を控除した後の金額。上限250万円) × 10%(100円未満切り捨て)
 * 標準的な工事費用相当額は、耐震改修の内容に応じて政令で定められた単価表に
 * 基づき算出される金額で、実際の工事費用そのものではない(実際の工事費用の方が
 * 少ない場合はその実額)。本ツールはこの単価表を持たないため、耐震改修
 * 促進税制の証明書(地方公共団体・指定確認検査機関・登録住宅性能評価機関・
 * 住宅瑕疵担保責任保険法人が発行する増改築等工事証明書)に記載された
 * 標準的な工事費用相当額をそのまま入力する前提とする。
 *
 * **制約:**
 *  - 住民税に相当する控除制度は存在しない(所得税のみの制度)。地方税法上、
 *    住宅借入金等特別税額控除のような住民税への振替制度は無いことを、
 *    複数の独立した情報源(税理士法人の解説記事・自治体の案内ページ)で確認した。
 *  - 適用期限(令和10年(2028年)12月31日までの改修が対象。過去に複数回
 *    延長されており、延長前の情報源では令和5年12月31日までと案内している
 *    ものも残っているため、実際の適用可否は国税庁の最新情報で確認すること)・
 *    対象家屋が耐震改修促進法に基づく耐震改修であるかの判定はユーザー自身が
 *    行う前提とする。
 *  - バリアフリー改修・多世帯同居改修・耐久性向上改修・子育て対応改修に対応する
 *    住宅特定改修特別税額控除(措置法41条の19の3)や、認定住宅等新築等特別税額控除
 *    (投資型減税。措置法41条の19の4)は別制度のため対象外。省エネ改修工事分は
 *    `energySavingRenovationDeduction.ts`、認定住宅等新築等特別税額控除は
 *    `certifiedHousingConstructionCredit.ts`でそれぞれ対応済み。
 */

const STANDARD_COST_CAP_JPY = new Decimal(2_500_000);
const CREDIT_RATE = 0.1;

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
}

export interface EarthquakeRenovationDeductionResult {
  standardCostJpy: Decimal;
  /** 控除額の計算基準額(標準的な工事費用相当額を250万円で頭打ちした金額) */
  cappedStandardCostJpy: Decimal;
  /** 控除額(所得税分のみ。100円未満切り捨て) */
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

  const cappedStandardCostJpy = Decimal.min(standardCostJpy, STANDARD_COST_CAP_JPY);
  const creditJpy = floorToHundredYen(cappedStandardCostJpy.times(CREDIT_RATE));

  const notes: string[] = [
    "租税特別措置法41条の19の2に基づく概算値。住民税に相当する控除制度は存在しないため、所得税額からのみ控除する(住宅ローン控除のような住民税への振替は無い)。",
    "対象は自己の居住の用に供する家屋で昭和56年5月31日以前に建築されたもの(現行の耐震基準に適合しないもの)に限られ、改修後は現行の耐震基準に適合させる耐震改修であることが必要。適用可否・対象工事の該当性はユーザー自身で確認すること。",
  ];
  if (standardCostJpy.greaterThan(STANDARD_COST_CAP_JPY)) {
    notes.push(
      "耐震改修に係る標準的な工事費用相当額が250万円を超えるため、控除額の計算上は250万円で頭打ちにした。",
    );
  }

  return {
    standardCostJpy,
    cappedStandardCostJpy,
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
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (!taxYear) return null;

  const record = await prisma.earthquakeRenovationDeductionRecord.findUnique({
    where: { taxYearId: taxYear.id },
  });
  if (!record) return null;

  return {
    taxYear: year,
    creditJpy: new Decimal(record.creditJpy.toString()),
  };
}
