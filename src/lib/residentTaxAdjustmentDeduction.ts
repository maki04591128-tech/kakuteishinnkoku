import { Decimal } from "decimal.js";

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
 * 洲本市の公式ページの一覧表と突き合わせて確認済み。基礎控除のみ、所得税の基礎控除が
 * 合計所得金額に応じた段階表(`src/lib/basicDeduction.ts`の
 * `NATIONAL_BASIC_DEDUCTION_TABLE_AFTER_REFORM`)に変わったことに伴い、単純な差額
 * (最大52万円)ではなく、合計所得金額336万円以下の層は「税制改正前の人的控除差5万円を
 * そのまま引き継ぐ」経過措置により5万円に据え置かれる(洲本市ページの脚注※1に明記)。
 * 336万円超の層は所得税・住民税の基礎控除額の単純な差額(25万円/20万円/15万円)がそのまま
 * 人的控除額の差になる。
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

interface DiffBracket {
  /** この金額以下ならこの区分を適用する(合計所得金額) */
  maxTotalIncomeJpy: number;
  diffJpy: number;
}

// 基礎控除の人的控除額の差(令和7年分・8年分。336万円以下は経過措置により5万円据え置き)
const BASIC_DEDUCTION_DIFF_AFTER_REFORM: DiffBracket[] = [
  { maxTotalIncomeJpy: 3_360_000, diffJpy: 50_000 },
  { maxTotalIncomeJpy: 4_890_000, diffJpy: 250_000 },
  { maxTotalIncomeJpy: 6_550_000, diffJpy: 200_000 },
  { maxTotalIncomeJpy: 23_500_000, diffJpy: 150_000 },
  { maxTotalIncomeJpy: 24_000_000, diffJpy: 50_000 },
  { maxTotalIncomeJpy: 24_500_000, diffJpy: 30_000 },
  { maxTotalIncomeJpy: 25_000_000, diffJpy: 10_000 },
];

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
