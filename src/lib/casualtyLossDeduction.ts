import { Decimal } from "decimal.js";

/**
 * 雑損控除額を試算する(所得税法72条・地方税法34条1項1号・314条の2第1項1号等・
 * 国税庁タックスアンサーNo.1110)。
 *
 * 災害・盗難・横領により住宅家財等の生活用資産に損害を受けた場合に、
 * 一定額を所得から控除できる制度。詐欺・恐喝による損失は対象外。
 *
 * 差引損失額 = 損害金額 + 災害関連支出の金額 - 保険金等により補填される金額
 * (保険金等は損害の原状回復等を目的とした金額のため、この試算ではまず
 * 損害金額に充当し、なお残額があれば災害関連支出の金額に充当する)
 *
 * 控除額は次のいずれか多い方の金額:
 *   1. 差引損失額 - 総所得金額等 × 10%
 *   2. 差引損失額のうち災害関連支出の金額 - 5万円
 *
 * 損害金額は原則として損失発生直前の資産の時価を基礎に算出する(取得価額から
 * 減価償却費相当額を控除した金額を基礎にする簡便法も認められるが、いずれも
 * この試算では金額を直接入力する方式のため算定自体はユーザーに委ねる)。
 *
 * 所得税・住民税とも同一の算式(地方税法上も国税と同じ計算方法)のため、
 * この試算では控除額を同額として扱う。
 *
 * 控除しきれなかった金額を翌年以後3年間繰り越せる「雑損失の繰越控除」は
 * 未対応(今後の課題)。
 */

export interface CasualtyLossDeductionInput {
  /** 損害を受けた資産の損失額(損失発生直前の時価等を基礎に算出。保険金等控除前) */
  damageAmountJpy: Decimal.Value;
  /** 災害等関連支出の金額(取り壊し費用・原状回復費用・盗難防止費用等。保険金等控除前) */
  disasterRelatedExpenseJpy: Decimal.Value;
  /** 保険金・損害賠償金等により補填される金額 */
  insuranceReimbursementJpy: Decimal.Value;
  /** その年の総所得金額等 */
  totalIncomeJpy: Decimal.Value;
}

export interface CasualtyLossDeductionResult {
  /** 差引損失額(損害金額+災害関連支出額-保険金等補填額) */
  netLossJpy: Decimal;
  /** 差引損失額のうち災害関連支出に相当する部分(保険金等は損害金額に優先充当) */
  netDisasterRelatedExpenseJpy: Decimal;
  /** 算式1: 差引損失額 - 総所得金額等×10% */
  incomeBasedAmountJpy: Decimal;
  /** 算式2: 差引損失額のうち災害関連支出額 - 5万円 */
  expenseBasedAmountJpy: Decimal;
  /** 控除額(所得税) = 算式1・2のいずれか多い方 */
  incomeTaxDeductionJpy: Decimal;
  /** 控除額(住民税) = 所得税と同一の算式のため同額 */
  residentTaxDeductionJpy: Decimal;
  notes: string[];
}

const INCOME_RATIO = new Decimal("0.1");
const EXPENSE_FLOOR_JPY = new Decimal(50_000);

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上である必要があります`);
  }
}

export function estimateCasualtyLossDeduction(
  input: CasualtyLossDeductionInput,
): CasualtyLossDeductionResult {
  const damageAmountJpy = new Decimal(input.damageAmountJpy);
  const disasterRelatedExpenseJpy = new Decimal(input.disasterRelatedExpenseJpy);
  const insuranceReimbursementJpy = new Decimal(input.insuranceReimbursementJpy);
  const totalIncomeJpy = new Decimal(input.totalIncomeJpy);

  requireNonNegative(damageAmountJpy, "損害金額");
  requireNonNegative(disasterRelatedExpenseJpy, "災害関連支出の金額");
  requireNonNegative(insuranceReimbursementJpy, "保険金等により補填される金額");
  requireNonNegative(totalIncomeJpy, "総所得金額等");

  const netDamageAmountJpy = Decimal.max(0, damageAmountJpy.minus(insuranceReimbursementJpy));
  const remainingReimbursementJpy = Decimal.max(
    0,
    insuranceReimbursementJpy.minus(damageAmountJpy),
  );
  const netDisasterRelatedExpenseJpy = Decimal.max(
    0,
    disasterRelatedExpenseJpy.minus(remainingReimbursementJpy),
  );

  const netLossJpy = netDamageAmountJpy.plus(netDisasterRelatedExpenseJpy);

  const incomeBasedAmountJpy = Decimal.max(0, netLossJpy.minus(totalIncomeJpy.times(INCOME_RATIO)));
  const expenseBasedAmountJpy = Decimal.max(
    0,
    netDisasterRelatedExpenseJpy.minus(EXPENSE_FLOOR_JPY),
  );

  const deductionAmountJpy = Decimal.max(incomeBasedAmountJpy, expenseBasedAmountJpy);

  const notes: string[] = [
    "国税庁タックスアンサーNo.1110の計算式による概算値。損害金額は原則として損失発生直前の資産の時価を基礎に算出するため、実際の金額算定(減価償却費相当額を控除した取得価額による簡便法を含む)は自身で行うこと。",
    "対象は災害・盗難・横領による損失のみで、詐欺・恐喝による損失は対象外(税務上は「雑損控除」ではなく別の取扱いとなる)。",
    "保険金等により補填される金額は、まず損害金額に充当し、なお残額があれば災害関連支出の金額に充当して計算している。",
    "所得税・住民税とも同一の算式のため、この試算では控除額を同額として扱う。",
    "その年の所得金額から控除しきれなかった場合に翌年以後3年間繰り越せる「雑損失の繰越控除」は本ツールでは未対応(今後の課題)。",
  ];

  return {
    netLossJpy,
    netDisasterRelatedExpenseJpy,
    incomeBasedAmountJpy,
    expenseBasedAmountJpy,
    incomeTaxDeductionJpy: deductionAmountJpy,
    residentTaxDeductionJpy: deductionAmountJpy,
    notes,
  };
}
