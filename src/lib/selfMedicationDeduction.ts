import { Decimal } from "decimal.js";

/**
 * セルフメディケーション税制(特定一般用医薬品等購入費控除。租税特別措置法41条の17)の
 * 控除額を試算する。医療費控除(src/lib/medicalExpenseDeduction.ts)とは選択制で
 * 併用できないため、`compareMedicalDeductionOptions`で両者の控除額を比較し、
 * どちらが有利かを判定する機能もあわせて提供する。
 *
 * 計算式:
 *   セルフメディケーション税制の控除額
 *     = 特定一般用医薬品等(スイッチOTC医薬品等)の購入費の合計額 − 保険金等で補填される金額
 *       − 12,000円
 *   ただし控除額の上限は88,000円(購入費ベースでは10万円)、マイナスにはならない(0円が下限)。
 *
 * 簡略化している点:
 *  - 適用には健康の保持増進及び疾病の予防への「一定の取組」
 *    (特定健康診査・予防接種・定期健康診断・健康診査・がん検診等のいずれか)を
 *    行っていることが要件だが、取組の実施有無自体の判定はユーザーに委ね、
 *    本ツールはチェックの有無に応じた注記を表示するのみで計算式には影響させない
 *    (取組を行っていない場合はそもそも適用できないため、その場合の控除額表示は
 *    参考値にとどまる)。
 *  - 対象となる医薬品(スイッチOTC医薬品等)かどうかの判定は購入時にユーザー自身が
 *    行う前提とし、本ツールは判定を行わない。
 */

export interface SelfMedicationDeductionInput {
  /** その年に支払った特定一般用医薬品等(スイッチOTC医薬品等)購入費の合計額 */
  totalOtcDrugPurchasesJpy: Decimal.Value;
  /** 保険金・給付金等で補填される金額の合計 */
  insuranceReimbursementJpy: Decimal.Value;
  /** 健康の保持増進及び疾病の予防への一定の取組(健康診断・予防接種等)を行っているか */
  engagedInHealthInitiatives: boolean;
}

export interface SelfMedicationDeductionResult {
  totalOtcDrugPurchasesJpy: Decimal;
  insuranceReimbursementJpy: Decimal;
  engagedInHealthInitiatives: boolean;
  /** 差引金額(購入費の合計額 − 保険金等の補填額。マイナスにはならない) */
  netOtcDrugPurchasesJpy: Decimal;
  /** 足切り額(定額12,000円) */
  thresholdJpy: Decimal;
  /** セルフメディケーション税制の控除額(上限88,000円) */
  deductionJpy: Decimal;
  notes: string[];
}

const THRESHOLD_JPY = new Decimal(12_000);
const MAX_DEDUCTION_JPY = new Decimal(88_000);

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateSelfMedicationDeduction(
  input: SelfMedicationDeductionInput,
): SelfMedicationDeductionResult {
  const totalOtcDrugPurchasesJpy = new Decimal(input.totalOtcDrugPurchasesJpy);
  const insuranceReimbursementJpy = new Decimal(input.insuranceReimbursementJpy);

  requireNonNegative(totalOtcDrugPurchasesJpy, "特定一般用医薬品等購入費の合計額");
  requireNonNegative(insuranceReimbursementJpy, "保険金等で補填される金額");

  const netOtcDrugPurchasesJpy = Decimal.max(
    0,
    totalOtcDrugPurchasesJpy.minus(insuranceReimbursementJpy),
  );
  const deductionJpy = Decimal.min(
    MAX_DEDUCTION_JPY,
    Decimal.max(0, netOtcDrugPurchasesJpy.minus(THRESHOLD_JPY)),
  );

  const notes: string[] = [
    "国税庁のセルフメディケーション税制の計算式による概算値。実際の申告ではセルフメディケーション税制の明細書の作成が必要。",
    "通常の医療費控除とは選択制で併用できない(どちらか一方のみ申告できる)。",
  ];
  if (!input.engagedInHealthInitiatives) {
    notes.push(
      "健康の保持増進及び疾病の予防への一定の取組(健康診断・予防接種等)を行っていない場合はそもそも適用できないため、この控除額は参考値にとどまる。",
    );
  }

  return {
    totalOtcDrugPurchasesJpy,
    insuranceReimbursementJpy,
    engagedInHealthInitiatives: input.engagedInHealthInitiatives,
    netOtcDrugPurchasesJpy,
    thresholdJpy: THRESHOLD_JPY,
    deductionJpy,
    notes,
  };
}

export type MedicalDeductionRecommendation = "MEDICAL_EXPENSE" | "SELF_MEDICATION" | "EITHER";

export interface MedicalDeductionComparison {
  medicalExpenseDeductionJpy: Decimal;
  selfMedicationDeductionJpy: Decimal;
  /** どちらの制度を選ぶと有利か(同額の場合はEITHER。両方0円でもEITHER) */
  recommended: MedicalDeductionRecommendation;
  /** 有利な方と不利な方の控除額の差 */
  advantageJpy: Decimal;
}

/**
 * 医療費控除とセルフメディケーション税制の控除額を比較し、有利な方を判定する。
 * 両制度は選択制で併用できないため、確定申告ではどちらか一方のみを選んで適用する。
 */
export function compareMedicalDeductionOptions(
  medicalExpenseDeductionJpy: Decimal.Value,
  selfMedicationDeductionJpy: Decimal.Value,
): MedicalDeductionComparison {
  const medical = new Decimal(medicalExpenseDeductionJpy);
  const selfMedication = new Decimal(selfMedicationDeductionJpy);

  const recommended: MedicalDeductionRecommendation = medical.equals(selfMedication)
    ? "EITHER"
    : medical.greaterThan(selfMedication)
      ? "MEDICAL_EXPENSE"
      : "SELF_MEDICATION";
  const advantageJpy = Decimal.max(medical, selfMedication).minus(
    Decimal.min(medical, selfMedication),
  );

  return {
    medicalExpenseDeductionJpy: medical,
    selfMedicationDeductionJpy: selfMedication,
    recommended,
    advantageJpy,
  };
}
