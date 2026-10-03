/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`saveEmploymentIncomeRecord`/
 * `deleteEmploymentIncomeRecord`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(入力検証・リポジトリ呼び出し・
 * 次の遷移先の決定)をコア関数として切り出した。3-12〜3-24の「発生年の入力・
 * バリデーションが無い単純な年単位レコードの登録/削除」パターンと同様。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { EmploymentIncomeRecordRepository } from "@/lib/repositories/employmentIncomeRecordRepository";

export interface SaveEmploymentIncomeRecordInput {
  year: number;
  grossSalaryJpy: string;
}

export interface DeleteEmploymentIncomeRecordInput {
  year: number;
}

export interface EmploymentIncomeRecordActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function saveEmploymentIncomeRecordCore(
  taxYearRepository: TaxYearRepository,
  employmentIncomeRecordRepository: EmploymentIncomeRecordRepository,
  input: SaveEmploymentIncomeRecordInput,
): Promise<EmploymentIncomeRecordActionResult> {
  const { year, grossSalaryJpy } = input;

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await employmentIncomeRecordRepository.upsert({
    taxYearId: taxYear.id,
    grossSalaryJpy,
  });

  return {
    redirectTo: `/employment-income?year=${year}&employmentIncomeSaved=1`,
  };
}

export async function deleteEmploymentIncomeRecordCore(
  taxYearRepository: TaxYearRepository,
  employmentIncomeRecordRepository: EmploymentIncomeRecordRepository,
  input: DeleteEmploymentIncomeRecordInput,
): Promise<EmploymentIncomeRecordActionResult> {
  const { year } = input;

  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await employmentIncomeRecordRepository.deleteByTaxYearId(taxYear.id);
  }

  return {
    redirectTo: `/employment-income?year=${year}&employmentIncomeDeleted=1`,
  };
}
