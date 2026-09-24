import { Decimal } from "decimal.js";

/**
 * 寡婦控除・ひとり親控除・勤労学生控除の額を試算する
 * (国税庁タックスアンサーNo.1170・No.1171・No.1175)。
 *
 * 確定申告書第一表では「障害者、寡婦、ひとり親、勤労学生控除」として
 * 4つの区分が1つの合計金額欄を共有する(区分ごとのチェック欄は別)。
 * 障害者控除は`src/lib/disabilityDeduction.ts`で別途試算する。
 *
 * 寡婦控除とひとり親控除は選択制で併用できない
 * (ひとり親控除の要件を満たす場合、寡婦控除は適用されない)ため、
 * この試算では1つの区分選択(該当なし/寡婦/ひとり親)として入力する。
 * 勤労学生控除はこれらと独立した別要件のため、別途チェックボックスで入力する
 * (寡婦・ひとり親と勤労学生控除は理論上併用可能)。
 *
 * 主な適用要件(いずれも納税者本人の合計所得金額に関する要件を含むため、
 * この試算では判定せずユーザー自身の確認に委ねる):
 *   寡婦控除: その年の12/31時点で夫と死別・離婚した後婚姻していない者等のうち、
 *     ひとり親控除の要件に該当せず、合計所得金額500万円以下であること。
 *     離婚の場合は扶養親族を有することが追加要件(死別の場合は不要)。
 *     事実上婚姻関係と同様の事情にある者がいないこと。
 *   ひとり親控除: その年の12/31時点で婚姻をしていない者等のうち、
 *     生計を一にする子(総所得金額48万円以下、他の者の同一生計配偶者・
 *     扶養親族になっていない)を有し、合計所得金額500万円以下であること。
 *     事実上婚姻関係と同様の事情にある者がいないこと。
 *   勤労学生控除: 学校教育法上の学校等の学生・生徒等で、自己の勤労による
 *     事業所得・給与所得等があり、合計所得金額75万円以下(かつ給与所得等以外の
 *     所得が10万円以下)であること。この所得要件は令和7年度税制改正・令和8年度
 *     税制改正により段階的に引き上げられており(令和6年分以前75万円→令和7年分
 *     〔2025年分〕85万円→令和8年分〔2026年分〕以後89万円。国税庁タックスアンサー
 *     No.1175「勤労学生控除」参照)、控除額自体(所得税27万円・住民税26万円)は
 *     いずれの年分も変わらない。この試算は要件適合性を判定しないため(冒頭の
 *     `year`引数の説明を参照)、注記文言の年分表示のみを切り替える。
 */

export type WidowSingleParentCategory = "NONE" | "WIDOW" | "SINGLE_PARENT";

export interface WidowSingleParentDeductionInput {
  /** 寡婦控除・ひとり親控除の区分(選択制のため1つのみ選択) */
  category: WidowSingleParentCategory;
  /** 勤労学生控除に該当するか(寡婦・ひとり親控除とは独立した別要件) */
  workingStudent: boolean;
  /**
   * 課税年分(西暦)。勤労学生控除の合計所得金額要件(注記文言のみに使用。控除額
   * 自体には影響しない)を年分に応じて表示する: 令和8年分(2026年分)以後は89万円、
   * 令和7年分(2025年分)は85万円、令和6年分(2024年分)以前は75万円。省略時は
   * 令和6年分以前(75万円)の表示を使う。
   */
  year?: number;
}

export interface WidowSingleParentDeductionResult {
  categoryIncomeTaxDeductionJpy: Decimal;
  categoryResidentTaxDeductionJpy: Decimal;
  workingStudentIncomeTaxDeductionJpy: Decimal;
  workingStudentResidentTaxDeductionJpy: Decimal;
  totalIncomeTaxDeductionJpy: Decimal;
  totalResidentTaxDeductionJpy: Decimal;
  notes: string[];
}

const WIDOW_INCOME_TAX_JPY = new Decimal(270_000);
const WIDOW_RESIDENT_TAX_JPY = new Decimal(260_000);

const SINGLE_PARENT_INCOME_TAX_JPY = new Decimal(350_000);
const SINGLE_PARENT_RESIDENT_TAX_JPY = new Decimal(300_000);

const WORKING_STUDENT_INCOME_TAX_JPY = new Decimal(270_000);
const WORKING_STUDENT_RESIDENT_TAX_JPY = new Decimal(260_000);

function categoryDeduction(category: WidowSingleParentCategory): {
  incomeTaxAmountJpy: Decimal;
  residentTaxAmountJpy: Decimal;
} {
  switch (category) {
    case "WIDOW":
      return { incomeTaxAmountJpy: WIDOW_INCOME_TAX_JPY, residentTaxAmountJpy: WIDOW_RESIDENT_TAX_JPY };
    case "SINGLE_PARENT":
      return {
        incomeTaxAmountJpy: SINGLE_PARENT_INCOME_TAX_JPY,
        residentTaxAmountJpy: SINGLE_PARENT_RESIDENT_TAX_JPY,
      };
    case "NONE":
      return { incomeTaxAmountJpy: new Decimal(0), residentTaxAmountJpy: new Decimal(0) };
  }
}

function workingStudentIncomeLimitLabel(year: number): string {
  if (year >= 2026) return "89万円";
  if (year >= 2025) return "85万円";
  return "75万円";
}

export function estimateWidowSingleParentDeduction(
  input: WidowSingleParentDeductionInput,
): WidowSingleParentDeductionResult {
  const category = categoryDeduction(input.category);
  const workingStudentIncomeTaxDeductionJpy = input.workingStudent
    ? WORKING_STUDENT_INCOME_TAX_JPY
    : new Decimal(0);
  const workingStudentResidentTaxDeductionJpy = input.workingStudent
    ? WORKING_STUDENT_RESIDENT_TAX_JPY
    : new Decimal(0);

  const workingStudentIncomeLimitJpyLabel = workingStudentIncomeLimitLabel(input.year ?? 0);
  const notes: string[] = [
    `国税庁タックスアンサーNo.1170(寡婦控除)・No.1171(ひとり親控除)・No.1175(勤労学生控除)の速算表による概算値。合計所得金額の要件(寡婦・ひとり親は500万円以下、勤労学生は${workingStudentIncomeLimitJpyLabel}以下かつ給与所得等以外10万円以下)等の適用可否はこの試算では判定しないため、必ず自身で確認すること。`,
    "寡婦控除とひとり親控除は選択制で併用できない(ひとり親控除の要件を満たす場合、寡婦控除は適用されない)。",
    "勤労学生控除は寡婦控除・ひとり親控除とは独立した別要件のため、理論上は併用できる。",
  ];

  return {
    categoryIncomeTaxDeductionJpy: category.incomeTaxAmountJpy,
    categoryResidentTaxDeductionJpy: category.residentTaxAmountJpy,
    workingStudentIncomeTaxDeductionJpy,
    workingStudentResidentTaxDeductionJpy,
    totalIncomeTaxDeductionJpy: category.incomeTaxAmountJpy.plus(
      workingStudentIncomeTaxDeductionJpy,
    ),
    totalResidentTaxDeductionJpy: category.residentTaxAmountJpy.plus(
      workingStudentResidentTaxDeductionJpy,
    ),
    notes,
  };
}
