import { Decimal } from "decimal.js";

/**
 * 医療費控除額を試算する(所得税法73条)。国税庁の計算式に基づく概算値。
 *
 * 計算式:
 *   医療費控除額
 *     = 実際に支払った医療費の合計額 − 保険金等で補填される金額
 *       − (10万円 と 総所得金額等の5%相当額 のいずれか少ない方の金額)
 *   ただし控除額の上限は200万円、マイナスにはならない(0円が下限)。
 *
 * 簡略化している点:
 *  - 医療費控除に代えて選択できる「セルフメディケーション税制」
 *    (特定一般用医薬品等購入費控除)は別制度のため、この関数自体は対象外
 *    (併用不可)。両制度の控除額を比較して有利な方を判定する機能は
 *    `src/lib/selfMedicationDeduction.ts`の`compareMedicalDeductionOptions`を参照。
 *  - 「保険金等で補填される金額」は生命保険の入院給付金・健康保険の高額療養費・
 *    出産育児一時金等の合計額をユーザーが集計して入力する前提(補填の対象と
 *    なった医療費を超えて他の医療費から差し引く必要はないが、本ツールでは
 *    集計を簡略化し年間合計額同士の差し引きとして扱う)。
 */

export interface MedicalExpenseDeductionInput {
  /** その年に実際に支払った医療費の合計額 */
  totalMedicalExpensesJpy: Decimal.Value;
  /** 保険金・給付金等で補填される金額の合計(生命保険の入院給付金、高額療養費、出産育児一時金等) */
  insuranceReimbursementJpy: Decimal.Value;
  /** その年の総所得金額等(所得控除前。給与所得+暗号資産雑所得+株式等譲渡所得+配当所得+先物雑所得等の合計) */
  totalIncomeJpy: Decimal.Value;
}

export interface MedicalExpenseDeductionResult {
  totalMedicalExpensesJpy: Decimal;
  insuranceReimbursementJpy: Decimal;
  totalIncomeJpy: Decimal;
  /** 差引金額(医療費の合計額 − 保険金等の補填額。マイナスにはならない) */
  netMedicalExpensesJpy: Decimal;
  /** 総所得金額等の5%相当額 */
  fivePercentOfIncomeJpy: Decimal;
  /** 足切り額(10万円 と 総所得金額等の5%相当額 のいずれか少ない方) */
  thresholdJpy: Decimal;
  /** 医療費控除額(上限200万円) */
  deductionJpy: Decimal;
  notes: string[];
}

const FIXED_THRESHOLD_JPY = new Decimal(100_000);
const THRESHOLD_INCOME_RATE = 0.05;
const MAX_DEDUCTION_JPY = new Decimal(2_000_000);

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateMedicalExpenseDeduction(
  input: MedicalExpenseDeductionInput,
): MedicalExpenseDeductionResult {
  const totalMedicalExpensesJpy = new Decimal(input.totalMedicalExpensesJpy);
  const insuranceReimbursementJpy = new Decimal(input.insuranceReimbursementJpy);
  const totalIncomeJpy = new Decimal(input.totalIncomeJpy);

  requireNonNegative(totalMedicalExpensesJpy, "支払った医療費の合計額");
  requireNonNegative(insuranceReimbursementJpy, "保険金等で補填される金額");
  requireNonNegative(totalIncomeJpy, "総所得金額等");

  const netMedicalExpensesJpy = Decimal.max(
    0,
    totalMedicalExpensesJpy.minus(insuranceReimbursementJpy),
  );
  const fivePercentOfIncomeJpy = totalIncomeJpy.times(THRESHOLD_INCOME_RATE);
  const thresholdJpy = Decimal.min(FIXED_THRESHOLD_JPY, fivePercentOfIncomeJpy);
  const deductionJpy = Decimal.min(
    MAX_DEDUCTION_JPY,
    Decimal.max(0, netMedicalExpensesJpy.minus(thresholdJpy)),
  );

  const notes: string[] = [
    "国税庁の医療費控除の計算式による概算値。実際の申告では医療費控除の明細書の作成が必要。",
    "セルフメディケーション税制(特定一般用医薬品等購入費控除)とは選択制で併用できない。どちらが有利かは/medical-expense-deductionのセルフメディケーション税制との比較で確認できる。",
    "保険金等の補填額は、対象となった医療費の額を超えて他の医療費からは差し引かない扱いが原則だが、本ツールでは年間合計額同士の差し引きとして簡略化している。",
  ];
  if (totalIncomeJpy.lessThan(2_000_000)) {
    notes.push(
      "総所得金額等が200万円未満のため、足切り額は10万円ではなく総所得金額等の5%相当額が適用される。",
    );
  }

  return {
    totalMedicalExpensesJpy,
    insuranceReimbursementJpy,
    totalIncomeJpy,
    netMedicalExpensesJpy,
    fivePercentOfIncomeJpy,
    thresholdJpy,
    deductionJpy,
    notes,
  };
}
