import { Decimal } from "decimal.js";

/**
 * 社会保険料控除額を試算する(所得税法74条)。
 *
 * この控除は国民年金・国民健康保険・厚生年金・雇用保険等の社会保険料を対象とし、
 * 小規模企業共済等掛金控除と同様に上限は無く、**その年に支払った金額の全額**が
 * そのまま所得税・住民税共通の控除額になる(生命保険料控除や医療費控除のような
 * 速算表・足切りは存在しない)。納税者本人分だけでなく、生計を一にする配偶者
 * その他の親族の社会保険料を本人が支払った場合もその金額を含められる。
 *
 * 国民年金基金の掛金・国民年金の付加保険料は、小規模企業共済等掛金控除
 * (`smallBusinessMutualAidDeduction.ts`)の対象ではなく、この社会保険料控除の
 * 対象である点に注意(iDeCoの年間拠出限度額の計算では両者を合算するが、
 * 所得控除としての適用条文・区分は別)。
 *
 * 簡略化している点:
 *  - 給与所得者本人が年末調整で控除済みの厚生年金保険料・雇用保険料・
 *    健康保険料(給与天引き分)は、通常は勤務先の年末調整で処理済みのため
 *    確定申告での追加入力は不要である。この試算画面への入力が必要になるのは
 *    主に、家族の国民年金保険料を本人が支払肩代わりした場合や、年の途中で
 *    退職して国民健康保険・国民年金に切り替えた場合等、年末調整でカバー
 *    されない分。本ツールはどちらのケースかを判定せず、入力された金額の
 *    合計をそのまま返す。
 */

export interface SocialInsuranceDeductionInput {
  /** 国民年金保険料(追納分を含む) */
  nationalPensionJpy: Decimal.Value;
  /** 国民年金基金の掛金 */
  nationalPensionFundJpy: Decimal.Value;
  /** 国民年金の付加保険料 */
  nationalPensionSupplementaryJpy: Decimal.Value;
  /** 国民健康保険料(税) */
  nationalHealthInsuranceJpy: Decimal.Value;
  /** 後期高齢者医療保険料 */
  lateStageElderlyMedicalInsuranceJpy: Decimal.Value;
  /** 介護保険料(第1号被保険者分等) */
  longTermCareInsuranceJpy: Decimal.Value;
  /** 厚生年金保険料(年末調整でカバーされない分) */
  employeesPensionInsuranceJpy: Decimal.Value;
  /** 雇用保険料(年末調整でカバーされない分) */
  employmentInsuranceJpy: Decimal.Value;
  /** その他の社会保険料(任意継続被保険者の保険料等) */
  otherJpy: Decimal.Value;
}

export interface SocialInsuranceDeductionResult {
  nationalPensionJpy: Decimal;
  nationalPensionFundJpy: Decimal;
  nationalPensionSupplementaryJpy: Decimal;
  nationalHealthInsuranceJpy: Decimal;
  lateStageElderlyMedicalInsuranceJpy: Decimal;
  longTermCareInsuranceJpy: Decimal;
  employeesPensionInsuranceJpy: Decimal;
  employmentInsuranceJpy: Decimal;
  otherJpy: Decimal;
  /** 社会保険料控除額(所得税・住民税共通、支払額の全額) */
  deductionJpy: Decimal;
  notes: string[];
}

const FIELD_LABELS: Record<keyof SocialInsuranceDeductionInput, string> = {
  nationalPensionJpy: "国民年金保険料",
  nationalPensionFundJpy: "国民年金基金の掛金",
  nationalPensionSupplementaryJpy: "国民年金の付加保険料",
  nationalHealthInsuranceJpy: "国民健康保険料(税)",
  lateStageElderlyMedicalInsuranceJpy: "後期高齢者医療保険料",
  longTermCareInsuranceJpy: "介護保険料",
  employeesPensionInsuranceJpy: "厚生年金保険料",
  employmentInsuranceJpy: "雇用保険料",
  otherJpy: "その他の社会保険料",
};

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateSocialInsuranceDeduction(
  input: SocialInsuranceDeductionInput,
): SocialInsuranceDeductionResult {
  const values = {
    nationalPensionJpy: new Decimal(input.nationalPensionJpy),
    nationalPensionFundJpy: new Decimal(input.nationalPensionFundJpy),
    nationalPensionSupplementaryJpy: new Decimal(input.nationalPensionSupplementaryJpy),
    nationalHealthInsuranceJpy: new Decimal(input.nationalHealthInsuranceJpy),
    lateStageElderlyMedicalInsuranceJpy: new Decimal(input.lateStageElderlyMedicalInsuranceJpy),
    longTermCareInsuranceJpy: new Decimal(input.longTermCareInsuranceJpy),
    employeesPensionInsuranceJpy: new Decimal(input.employeesPensionInsuranceJpy),
    employmentInsuranceJpy: new Decimal(input.employmentInsuranceJpy),
    otherJpy: new Decimal(input.otherJpy),
  };

  for (const key of Object.keys(values) as (keyof typeof values)[]) {
    requireNonNegative(values[key], FIELD_LABELS[key]);
  }

  const deductionJpy = Object.values(values).reduce(
    (total, value) => total.plus(value),
    new Decimal(0),
  );

  const notes: string[] = [
    "社会保険料控除は上限が無く、その年に支払った金額の全額がそのまま所得税・住民税共通の控除額になる。",
    "納税者本人分だけでなく、生計を一にする配偶者その他の親族の社会保険料を本人が支払った場合はその金額も含められる。",
    "国民年金基金の掛金・国民年金の付加保険料は、小規模企業共済等掛金控除(iDeCo等)ではなくこの社会保険料控除の対象。",
    "給与から天引きされ勤務先の年末調整で控除済みの厚生年金保険料・雇用保険料・健康保険料は、通常この試算に含める必要は無い。年の途中の退職等で年末調整でカバーされていない分のみを入力すること。",
  ];

  return {
    ...values,
    deductionJpy,
    notes,
  };
}
