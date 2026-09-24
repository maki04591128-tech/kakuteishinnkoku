import { Decimal } from "decimal.js";
import { prisma } from "./db";

/**
 * 個人住民税の調整控除(地方税法附則3条の3等)を試算する。他の所得控除試算画面と
 * 同様、暗号資産・投資の計算エンジンとは独立した単体の試算ロジック。
 *
 * 調整控除は、税源移譲により生じた所得税と個人住民税の人的控除額(基礎控除・
 * 配偶者控除・扶養控除・障害者控除・寡婦控除・ひとり親控除・勤労学生控除)の差に
 * 基づく税負担増を、次の計算式により住民税の所得割額から控除する制度。
 *
 *   合計課税所得金額が200万円以下: 「人的控除額の差の合計額」と「合計課税所得金額」の
 *     いずれか少ない額 × 5%
 *   合計課税所得金額が200万円超: (「人的控除額の差の合計額」-(合計課税所得金額-200万円))
 *     × 5%(この額が5万円未満の場合は5万円 × 5%)
 *   合計所得金額が2,500万円超: 調整控除の適用なし(令和3年度税制改正)
 *
 * (複数の自治体公式サイトで内容が一致することを確認。洲本市「個人市県民税の
 * 税額控除(令和8年度課税以降適用)」https://www.city.sumoto.lg.jp/soshiki/5/11338.html
 * 等)。5%の市民税・県民税(または市町村民税・道府県民税)内訳(3%/2%)はこの試算では
 * 合算した住民税分としてのみ扱う(本アプリが住民税を所得割10%固定の単一値として
 * 扱っている既存の簡略化に合わせたもの)。
 *
 * **人的控除額の差(令和7年度税制改正・基礎控除の段階表への対応):**
 * 基礎控除以外の人的控除額の差(配偶者控除・扶養控除・障害者控除・寡婦控除・
 * ひとり親控除・勤労学生控除)は令和7年度税制改正の影響を受けず、`src/lib/
 * dependentDeduction.ts`・`src/lib/disabilityDeduction.ts`・
 * `src/lib/widowSingleParentDeduction.ts`で既に個別実装済みの所得税・住民税控除額
 * (国税庁タックスアンサー等が出典)から機械的に計算できる差額と一致することを、
 * 洲本市の公式ページの一覧表と突き合わせて確認済み。
 *
 * 基礎控除については、所得税の基礎控除が合計所得金額に応じた段階表
 * (`src/lib/basicDeduction.ts`)に変わった後も、住民税の調整控除上の人的控除額の差は
 * 「所得税の基礎控除額-住民税の基礎控除額43万円」という単純な引き算にはならない。
 * 洲本市「個人市県民税の税額控除(令和8年度課税以降適用)」(2025年11月28日更新)・
 * 境港市の同種の案内(調整控除(令和8年度以降)一覧表PDF)の双方で、合計所得金額
 * 2,500万円以下の全ての区分(132万円以下〜2,450万円超2,500万円以下)について、
 * 基礎控除の人的控除額の差は所得税・住民税それぞれの実額に関わらず一律5万円になると
 * 明記されている(2,400万円超2,450万円以下・2,450万円超2,500万円以下の高所得層側の
 * 逓減区分ですら、所得税32万円/16万円と住民税29万円/15万円の実差額である3万円/1万円
 * ではなく5万円のまま)。両市とも脚注で「税制改正後に控除差額を起因とする新たな
 * 負担増が生じることがないことから税制改正前(令和７年度まで)の人的控除差５万円を
 * そのまま引き継ぎます」と明記しており、地方税法等の一部改正法附則による経過措置として、
 * 所得税の基礎控除額がいくらに引き上げられても住民税側の人的控除額の差は旧来の5万円に
 * 据え置かれる仕組みであることが分かる。
 *
 * (旧実装の誤り: 本モジュールは以前、336万円超655万円以下の層について所得税・住民税の
 * 基礎控除額の単純な差額(25万円/20万円/15万円)をそのまま人的控除額の差として計算しており、
 * 上記の経過措置(全区分5万円据え置き)を336万円以下の層にしか適用していなかった。これは
 * 洲本市ページの表をrowspan(結合セル)の構造まで確認せずに読み誤ったことによる誤りで、
 * 実際には洲本市ページの「5万円※1」の結合セルは132万円以下から2,450万円超2,500万円以下
 * までの全区分にまたがっている。この誤りにより、合計所得金額336万円超655万円以下の
 * 利用者に対して本来より過大な調整控除額(基礎控除の差額として25万円/20万円/15万円、
 * 正しくは5万円)を案内していた。洲本市ページ・境港市PDFの双方を突き合わせて再確認した
 * 結果を踏まえ、`BASIC_DEDUCTION_DIFF_AFTER_REFORM`を全区分一律5万円に修正した。)
 *
 * **令和8年分(2026年分)以後の扱い(未検証・今後の課題):** 令和8年度税制改正
 * (令和7年12月26日閣議決定)により、物価連動の基礎控除引上げが恒久制度として新設され、
 * `src/lib/basicDeduction.ts`が実装する通り、令和8年分・9年分の所得税の基礎控除額は
 * 132万円以下・132万円超336万円以下・336万円超489万円以下がいずれも104万円、
 * 489万円超655万円以下は67万円、655万円超2,350万円以下は62万円になり(令和7年分の
 * 95万円/88万円/68万円/63万円/58万円から変わり)、令和10年分以後は132万円以下99万円・
 * 132万円超2,350万円以下62万円に統一される。上記の経過措置(人的控除額の差を旧来の
 * 5万円に据え置く)が所得税の基礎控除額の具体的な水準に関わらず適用される一般的な
 * 継続措置であることを踏まえると、令和8年分以後も同じく5万円に据え置かれる可能性が
 * 高いと考えられるが、令和8年度税制改正(令和7年12月26日閣議決定)を踏まえて更新された
 * 自治体公式ページを本稿執筆時点でまだ確認できていない(洲本市ページの更新日は
 * 2025年11月28日で同閣議決定より前、境港市PDFにも令和8年度税制改正を踏まえた
 * 更新の記載は見当たらない)。誤って過大・過小な調整控除額を案内するリスクを避けるため、
 * 本モジュールは令和8年分以後も暫定的に上記の5万円据え置きの表
 * (`BASIC_DEDUCTION_DIFF_AFTER_REFORM`)をそのまま適用し、
 * `estimateResidentTaxAdjustmentDeduction`の返り値`notes`に令和8年分以後は未検証である旨を
 * 明記する。
 *
 * 配偶者特別控除・特定親族特別控除(令和7年度税制改正で新設)は、いずれも人的控除額の
 * 差の対象に含まれない(洲本市ページの一覧表に記載が無く、配偶者控除・扶養控除の
 * 通常区分のみが対象)。
 *
 * ひとり親控除は、旧寡婦控除から引き継がれた沿革により父(旧寡夫控除相当)と母で
 * 人的控除額の差が異なる(父1万円・母5万円。洲本市ページの脚注※2に明記)。
 * `src/lib/widowSingleParentDeduction.ts`の控除額そのもの(所得税35万円・住民税30万円)は
 * 父母で差が無いため、この差異は調整控除の計算でのみ扱う。
 */

const REFORM_YEAR = 2025;
/**
 * この年分以後は、令和8年度税制改正による所得税の基礎控除額のさらなる引上げ後も
 * 人的控除額の差の経過措置(5万円据え置き)が同様に継続するかどうかを踏まえた自治体
 * 公式ページを一次情報で確認できておらず、`BASIC_DEDUCTION_DIFF_AFTER_REFORM`
 * (5万円据え置き)を暫定適用する
 */
const BASIC_DEDUCTION_DIFF_UNVERIFIED_YEAR = 2026;

interface DiffBracket {
  /** この金額以下ならこの区分を適用する(合計所得金額) */
  maxTotalIncomeJpy: number;
  diffJpy: number;
}

// 基礎控除の人的控除額の差(令和7年分以後。経過措置により合計所得金額2,500万円以下の
// 全区分で一律5万円に据え置かれる。洲本市・境港市の公式ページ双方で確認済み)
const BASIC_DEDUCTION_DIFF_AFTER_REFORM: DiffBracket[] = [{ maxTotalIncomeJpy: 25_000_000, diffJpy: 50_000 }];

// 基礎控除の人的控除額の差(令和6年分以前。2,400万円以下は一律5万円)
const BASIC_DEDUCTION_DIFF_BEFORE_REFORM: DiffBracket[] = [
  { maxTotalIncomeJpy: 24_000_000, diffJpy: 50_000 },
  { maxTotalIncomeJpy: 24_500_000, diffJpy: 30_000 },
  { maxTotalIncomeJpy: 25_000_000, diffJpy: 10_000 },
];

function lookupDiffJpy(table: DiffBracket[], totalIncomeJpy: Decimal): Decimal {
  const row = table.find((r) => totalIncomeJpy.lessThanOrEqualTo(r.maxTotalIncomeJpy));
  return new Decimal(row?.diffJpy ?? 0);
}

export type SpouseDeductionDiffCategory = "GENERAL" | "ELDERLY";

// 配偶者控除の人的控除額の差。[900万以下, 900万超950万以下, 950万超1000万以下]
const SPOUSE_DEDUCTION_DIFF_TABLE: Record<SpouseDeductionDiffCategory, [number, number, number]> = {
  GENERAL: [50_000, 40_000, 20_000],
  ELDERLY: [100_000, 60_000, 30_000],
};

export type DependentDeductionDiffCategory =
  | "GENERAL"
  | "SPECIFIED"
  | "ELDERLY_COHABITING"
  | "ELDERLY_OTHER";

// 扶養控除の人的控除額の差(所得金額による変動なし)
const DEPENDENT_DEDUCTION_DIFF_TABLE: Record<DependentDeductionDiffCategory, number> = {
  GENERAL: 50_000,
  SPECIFIED: 180_000,
  ELDERLY_COHABITING: 130_000,
  ELDERLY_OTHER: 100_000,
};

// 障害者控除の人的控除額の差(1人あたり)
const DISABILITY_DIFF_GENERAL_JPY = 10_000;
const DISABILITY_DIFF_SPECIAL_JPY = 100_000;
const DISABILITY_DIFF_SPECIAL_LIVING_TOGETHER_JPY = 220_000;

// 寡婦控除・勤労学生控除の人的控除額の差
const WIDOW_DIFF_JPY = 10_000;
const WORKING_STUDENT_DIFF_JPY = 10_000;
// ひとり親控除の人的控除額の差(父は旧寡夫控除相当の1万円、母は5万円を引き継ぐ)
const SINGLE_PARENT_FATHER_DIFF_JPY = 10_000;
const SINGLE_PARENT_MOTHER_DIFF_JPY = 50_000;

export interface PersonalDeductionDifferenceInput {
  /**
   * 課税年分(西暦)。基礎控除の人的控除額の差の判定に使用する。令和7年分
   * (2025年分)以後は段階表(基礎控除の見直しに対応)、令和6年分以前は一律5万円
   * (2,400万円超は逓減)を適用する。省略時は令和6年分以前を適用する。
   */
  year?: number;
  /** 納税者本人のその年の合計所得金額(基礎控除・配偶者控除の人的控除額の差の判定に使用) */
  taxpayerTotalIncomeJpy: Decimal.Value;
  /** 配偶者控除の対象となる配偶者(配偶者特別控除は人的控除額の差の対象外)がいる場合の区分 */
  spouse?: { category: SpouseDeductionDiffCategory };
  /** 扶養控除の対象となる扶養親族の区分ごとの人数(特定親族特別控除は人的控除額の差の対象外) */
  dependents?: Partial<Record<DependentDeductionDiffCategory, number>>;
  /** 障害者控除の該当状況 */
  disability?: {
    /** 納税者本人の障害区分(本人は「同居特別障害者」区分の対象外) */
    taxpayerCategory?: "NONE" | "GENERAL" | "SPECIAL";
    /** 同一生計配偶者・扶養親族のうち、障害者(一般)に該当する人数 */
    generalCount?: number;
    /** 同一生計配偶者・扶養親族のうち、特別障害者(同居特別障害者を除く)に該当する人数 */
    specialCount?: number;
    /** 同一生計配偶者・扶養親族のうち、同居特別障害者に該当する人数 */
    specialLivingTogetherCount?: number;
  };
  /** 寡婦控除・ひとり親控除の区分(選択制のため1つのみ選択) */
  widowSingleParentCategory?: "NONE" | "WIDOW" | "SINGLE_PARENT_FATHER" | "SINGLE_PARENT_MOTHER";
  /** 勤労学生控除に該当するか(寡婦・ひとり親控除とは独立した別要件) */
  workingStudent?: boolean;
}

export interface PersonalDeductionDifferenceBreakdownItem {
  label: string;
  diffJpy: Decimal;
}

export interface PersonalDeductionDifferenceResult {
  totalJpy: Decimal;
  breakdown: PersonalDeductionDifferenceBreakdownItem[];
}

function requireNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label}は0以上の整数である必要があります`);
  }
}

function spouseIncomeBandIndex(taxpayerTotalIncomeJpy: Decimal): 0 | 1 | 2 | null {
  if (taxpayerTotalIncomeJpy.greaterThan(10_000_000)) return null;
  if (taxpayerTotalIncomeJpy.greaterThan(9_500_000)) return 2;
  if (taxpayerTotalIncomeJpy.greaterThan(9_000_000)) return 1;
  return 0;
}

/** 各種人的控除額の差を合算する */
export function calculatePersonalDeductionDifference(
  input: PersonalDeductionDifferenceInput,
): PersonalDeductionDifferenceResult {
  const taxpayerTotalIncomeJpy = new Decimal(input.taxpayerTotalIncomeJpy);
  if (taxpayerTotalIncomeJpy.isNegative()) {
    throw new Error("納税者本人の合計所得金額は0以上である必要があります");
  }

  const breakdown: PersonalDeductionDifferenceBreakdownItem[] = [];

  const isReformYear = (input.year ?? 0) >= REFORM_YEAR;
  const basicDiffJpy = lookupDiffJpy(
    isReformYear ? BASIC_DEDUCTION_DIFF_AFTER_REFORM : BASIC_DEDUCTION_DIFF_BEFORE_REFORM,
    taxpayerTotalIncomeJpy,
  );
  if (basicDiffJpy.greaterThan(0)) {
    breakdown.push({ label: "基礎控除", diffJpy: basicDiffJpy });
  }

  if (input.spouse) {
    const bandIndex = spouseIncomeBandIndex(taxpayerTotalIncomeJpy);
    if (bandIndex !== null) {
      const diffJpy = new Decimal(SPOUSE_DEDUCTION_DIFF_TABLE[input.spouse.category][bandIndex]);
      if (diffJpy.greaterThan(0)) {
        breakdown.push({
          label: input.spouse.category === "ELDERLY" ? "配偶者控除(老人控除対象配偶者)" : "配偶者控除",
          diffJpy,
        });
      }
    }
  }

  for (const [category, countRaw] of Object.entries(input.dependents ?? {}) as Array<
    [DependentDeductionDiffCategory, number | undefined]
  >) {
    const count = countRaw ?? 0;
    if (count === 0) continue;
    requireNonNegativeInteger(count, `扶養控除(${category})の人数`);
    const diffJpy = new Decimal(DEPENDENT_DEDUCTION_DIFF_TABLE[category]).times(count);
    breakdown.push({ label: `扶養控除(${DEPENDENT_CATEGORY_LABEL[category]}) × ${count}人`, diffJpy });
  }

  if (input.disability) {
    const {
      taxpayerCategory = "NONE",
      generalCount = 0,
      specialCount = 0,
      specialLivingTogetherCount = 0,
    } = input.disability;
    requireNonNegativeInteger(generalCount, "障害者(一般)の人数");
    requireNonNegativeInteger(specialCount, "特別障害者の人数");
    requireNonNegativeInteger(specialLivingTogetherCount, "同居特別障害者の人数");

    if (taxpayerCategory === "GENERAL") {
      breakdown.push({ label: "障害者控除(本人・一般)", diffJpy: new Decimal(DISABILITY_DIFF_GENERAL_JPY) });
    } else if (taxpayerCategory === "SPECIAL") {
      breakdown.push({ label: "障害者控除(本人・特別)", diffJpy: new Decimal(DISABILITY_DIFF_SPECIAL_JPY) });
    }
    if (generalCount > 0) {
      breakdown.push({
        label: `障害者控除(同一生計配偶者・扶養親族・一般) × ${generalCount}人`,
        diffJpy: new Decimal(DISABILITY_DIFF_GENERAL_JPY).times(generalCount),
      });
    }
    if (specialCount > 0) {
      breakdown.push({
        label: `障害者控除(同一生計配偶者・扶養親族・特別) × ${specialCount}人`,
        diffJpy: new Decimal(DISABILITY_DIFF_SPECIAL_JPY).times(specialCount),
      });
    }
    if (specialLivingTogetherCount > 0) {
      breakdown.push({
        label: `障害者控除(同一生計配偶者・扶養親族・同居特別) × ${specialLivingTogetherCount}人`,
        diffJpy: new Decimal(DISABILITY_DIFF_SPECIAL_LIVING_TOGETHER_JPY).times(specialLivingTogetherCount),
      });
    }
  }

  switch (input.widowSingleParentCategory) {
    case "WIDOW":
      breakdown.push({ label: "寡婦控除", diffJpy: new Decimal(WIDOW_DIFF_JPY) });
      break;
    case "SINGLE_PARENT_FATHER":
      breakdown.push({ label: "ひとり親控除(父)", diffJpy: new Decimal(SINGLE_PARENT_FATHER_DIFF_JPY) });
      break;
    case "SINGLE_PARENT_MOTHER":
      breakdown.push({ label: "ひとり親控除(母)", diffJpy: new Decimal(SINGLE_PARENT_MOTHER_DIFF_JPY) });
      break;
    default:
      break;
  }

  if (input.workingStudent) {
    breakdown.push({ label: "勤労学生控除", diffJpy: new Decimal(WORKING_STUDENT_DIFF_JPY) });
  }

  const totalJpy = breakdown.reduce((total, item) => total.plus(item.diffJpy), new Decimal(0));
  return { totalJpy, breakdown };
}

const DEPENDENT_CATEGORY_LABEL: Record<DependentDeductionDiffCategory, string> = {
  GENERAL: "一般",
  SPECIFIED: "特定扶養親族(19〜22歳)",
  ELDERLY_COHABITING: "老人扶養親族・同居老親等",
  ELDERLY_OTHER: "老人扶養親族・同居老親等以外",
};

const ADJUSTMENT_DEDUCTION_RATE = new Decimal("0.05");
const TAXABLE_INCOME_THRESHOLD_JPY = new Decimal(2_000_000);
const MINIMUM_DIFFERENCE_AFTER_THRESHOLD_JPY = new Decimal(50_000);
const TOTAL_INCOME_LIMIT_JPY = new Decimal(25_000_000);

export interface ResidentTaxAdjustmentDeductionInput {
  personalDeductionDifference: PersonalDeductionDifferenceInput;
  /**
   * 合計課税所得金額(課税総所得金額・課税山林所得金額・課税退職所得金額の合計。
   * 住民税の所得割の計算上の値で、所得控除適用後の金額)
   */
  totalTaxableIncomeJpy: Decimal.Value;
}

export interface ResidentTaxAdjustmentDeductionResult {
  personalDeductionDifferenceTotalJpy: Decimal;
  personalDeductionDifferenceBreakdown: PersonalDeductionDifferenceBreakdownItem[];
  adjustmentDeductionJpy: Decimal;
  notes: string[];
}

export function estimateResidentTaxAdjustmentDeduction(
  input: ResidentTaxAdjustmentDeductionInput,
): ResidentTaxAdjustmentDeductionResult {
  const totalTaxableIncomeJpy = new Decimal(input.totalTaxableIncomeJpy);
  if (totalTaxableIncomeJpy.isNegative()) {
    throw new Error("合計課税所得金額は0以上である必要があります");
  }

  const { totalJpy: personalDeductionDifferenceTotalJpy, breakdown } =
    calculatePersonalDeductionDifference(input.personalDeductionDifference);

  const taxpayerTotalIncomeJpy = new Decimal(input.personalDeductionDifference.taxpayerTotalIncomeJpy);
  const notes: string[] = [];

  if ((input.personalDeductionDifference.year ?? 0) >= BASIC_DEDUCTION_DIFF_UNVERIFIED_YEAR) {
    notes.push(
      "令和8年分(2026年分)以後は、令和8年度税制改正による所得税の基礎控除額のさらなる引上げ(令和7年分の95万円/88万円/68万円/63万円/58万円から令和8・9年分は104万円/67万円/62万円等に変更)後も、住民税の調整控除における基礎控除の人的控除額の差の経過措置(合計所得金額2,500万円以下は一律5万円据え置き)が同様に継続するかどうかを一次情報(自治体公式ページ)で確認できていないため、5万円据え置きの表を暫定適用した参考値である。",
    );
  }

  if (taxpayerTotalIncomeJpy.greaterThan(TOTAL_INCOME_LIMIT_JPY)) {
    notes.push("合計所得金額が2,500万円を超えるため、調整控除は適用されない(令和3年度税制改正)。");
    return {
      personalDeductionDifferenceTotalJpy,
      personalDeductionDifferenceBreakdown: breakdown,
      adjustmentDeductionJpy: new Decimal(0),
      notes,
    };
  }

  let baseJpy: Decimal;
  if (totalTaxableIncomeJpy.lessThanOrEqualTo(TAXABLE_INCOME_THRESHOLD_JPY)) {
    baseJpy = Decimal.min(personalDeductionDifferenceTotalJpy, totalTaxableIncomeJpy);
    notes.push("合計課税所得金額が200万円以下のため、「人的控除額の差の合計額」と「合計課税所得金額」のいずれか少ない額を基準に計算した。");
  } else {
    const reduced = personalDeductionDifferenceTotalJpy.minus(
      totalTaxableIncomeJpy.minus(TAXABLE_INCOME_THRESHOLD_JPY),
    );
    baseJpy = Decimal.max(reduced, MINIMUM_DIFFERENCE_AFTER_THRESHOLD_JPY);
    notes.push("合計課税所得金額が200万円を超えるため、「人的控除額の差の合計額-(合計課税所得金額-200万円)」(5万円未満の場合は5万円)を基準に計算した。");
  }

  const adjustmentDeductionJpy = baseJpy.times(ADJUSTMENT_DEDUCTION_RATE);
  notes.push(
    "市民税(町村民税)3%・道府県民税(都民税)2%相当の内訳は本アプリでは住民税分として合算する(住民税を所得割10%固定で扱う既存の簡略化に合わせたもの)。",
  );

  return {
    personalDeductionDifferenceTotalJpy,
    personalDeductionDifferenceBreakdown: breakdown,
    adjustmentDeductionJpy,
    notes,
  };
}

export interface ResidentTaxAdjustmentDeductionRecordEntry {
  taxYear: number;
  /** その年分の調整控除額(ResidentTaxAdjustmentDeductionResult.adjustmentDeductionJpy) */
  adjustmentDeductionJpy: Decimal;
}

/**
 * `/resident-tax-adjustment-deduction`で登録済みの、指定した年分の調整控除額を
 * DBから読み出す。住宅ローン控除(`getMortgageDeductionRecord`)・外国税額控除
 * (`getForeignTaxCreditRecord`)と同様、`/tax-estimate`の合計税額試算へ
 * 税額控除(住民税所得割のみ)として自動反映するために使う。未登録の年は null を返す。
 */
export async function getResidentTaxAdjustmentDeductionRecord(
  year: number,
): Promise<ResidentTaxAdjustmentDeductionRecordEntry | null> {
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (!taxYear) return null;

  const record = await prisma.residentTaxAdjustmentDeductionRecord.findUnique({
    where: { taxYearId: taxYear.id },
  });
  if (!record) return null;

  return {
    taxYear: year,
    adjustmentDeductionJpy: new Decimal(record.adjustmentDeductionJpy.toString()),
  };
}
