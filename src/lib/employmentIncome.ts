import { Decimal } from "decimal.js";
import { prisma } from "./db";
import { employmentIncomeDeductionJpy } from "./specificExpenseDeduction";

/**
 * 給与所得の試算(`/employment-income`)。給与収入金額(源泉徴収票の「支払金額」)から、
 * `employmentIncomeDeductionJpy`(`src/lib/specificExpenseDeduction.ts`。給与所得控除額の
 * 速算表、令和6年分以前は最低保障額55万円・令和7年分は65万円・令和8年分/9年分は74万円・
 * 令和10年分以後は69万円へ段階的に引き上げ)により給与所得控除額・給与所得金額を計算する。
 *
 * `/tax-estimate`はこれまで所得控除の登録が無い場合の「給与所得等の課税所得金額」の
 * 初期値として、実際の給与収入額とは無関係な固定値(500万円)を使っていた。この画面で
 * 給与収入金額を登録すると、`EmploymentIncomeRecord`テーブルに保存され、
 * `/tax-estimate`側でこの給与所得金額を初期値の基礎として使うようになる。
 *
 * 簡略化している点:
 *  - 所得金額調整控除(`incomeAmountAdjustmentDeduction.ts`)・特定支出控除
 *    (`specificExpenseDeduction.ts`)は、給与所得金額からさらに控除する別制度のため
 *    ここでは計算しない(該当する場合はそれぞれの試算画面から「所得控除として登録する」
 *    ことで`/tax-estimate`の初期値に反映される)。
 *  - 2か所以上から給与の支払を受ける場合の合算・年末調整未済分の扱い等は
 *    ユーザー自身が給与収入金額に合算して入力する前提。
 */
export interface EmploymentIncomeEstimateInput {
  /** 課税年分(西暦)。給与所得控除の最低保障額の引上げの反映に使う。省略時は令和6年分以前を適用。 */
  year?: number;
  /** その年の給与収入金額(源泉徴収票の「支払金額」) */
  grossSalaryJpy: Decimal.Value;
}

export interface EmploymentIncomeEstimateResult {
  grossSalaryJpy: Decimal;
  /** 給与所得控除額(速算表による概算) */
  employmentIncomeDeductionJpy: Decimal;
  /** 給与所得金額 = 給与収入金額 − 給与所得控除額 */
  employmentIncomeJpy: Decimal;
  notes: string[];
}

function requireNonNegative(value: Decimal, label: string): void {
  if (value.isNegative()) {
    throw new Error(`${label}は0以上で入力してください`);
  }
}

export function estimateEmploymentIncome(
  input: EmploymentIncomeEstimateInput,
): EmploymentIncomeEstimateResult {
  const grossSalaryJpy = new Decimal(input.grossSalaryJpy);
  requireNonNegative(grossSalaryJpy, "給与収入金額");

  const deductionJpy = employmentIncomeDeductionJpy(grossSalaryJpy, input.year);
  const employmentIncomeJpy = Decimal.max(0, grossSalaryJpy.minus(deductionJpy));

  return {
    grossSalaryJpy,
    employmentIncomeDeductionJpy: deductionJpy,
    employmentIncomeJpy,
    notes: [
      "給与所得控除額は速算表による概算値。実際の申告では「年末調整等のための給与所得控除後の給与等の金額の表」の1円単位の値と若干異なる場合がある。",
      "所得金額調整控除(給与収入850万円超の子育て・特別障害者等、または給与所得・公的年金等双方の所得がある場合)・特定支出控除の適用がある場合は、それぞれの試算画面(/income-amount-adjustment-deduction・/specific-expense-deduction)から別途「所得控除として登録する」ことで/tax-estimateの初期値に反映される。",
    ],
  };
}

export interface EmploymentIncomeRecordEntry {
  taxYear: number;
  grossSalaryJpy: Decimal;
  employmentIncomeJpy: Decimal;
}

/**
 * `/employment-income`で登録済みの、指定した年分の給与収入金額をDBから読み出し、
 * その場で給与所得金額を再計算して返す。未登録の年は null を返す。
 */
export async function getEmploymentIncomeRecord(
  year: number,
): Promise<EmploymentIncomeRecordEntry | null> {
  const taxYear = await prisma.taxYear.findUnique({ where: { year } });
  if (!taxYear) return null;

  const record = await prisma.employmentIncomeRecord.findUnique({
    where: { taxYearId: taxYear.id },
  });
  if (!record) return null;

  const grossSalaryJpy = new Decimal(record.grossSalaryJpy.toString());
  const employmentIncomeJpy = estimateEmploymentIncome({
    year,
    grossSalaryJpy,
  }).employmentIncomeJpy;

  return { taxYear: year, grossSalaryJpy, employmentIncomeJpy };
}
