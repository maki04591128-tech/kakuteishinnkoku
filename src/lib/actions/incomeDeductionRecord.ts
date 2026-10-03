/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`saveIncomeDeduction`/`deleteIncomeDeduction`から、
 * Next.js固有のAPI(`revalidatePath`/`redirect`)に依存しない部分
 * (入力検証・リポジトリ呼び出し・次の遷移先の決定)をコア関数として切り出した。
 * 3-12〜3-22の`save*Record`/`delete*Record`群と異なり、(1)所得控除区分`type`の
 * バリデーションがある、(2)削除時のキーが`taxYearId`のみでなく`taxYearId`+`type`
 * (`deleteByTaxYearIdAndType`)である、(3)遷移先のパス(`redirectPath`)が
 * 呼び出し元のFormData入力で可変(医療費控除・生命保険料控除等、複数の試算画面から
 * 呼ばれるため)、という3点が異なる。
 */
import type { IncomeDeductionType } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { IncomeDeductionRepository } from "@/lib/repositories/incomeDeductionRepository";
import { isIncomeDeductionType } from "@/lib/incomeDeduction";

export interface SaveIncomeDeductionInput {
  year: number;
  type: string;
  incomeTaxAmountJpy: string;
  residentTaxAmountJpy: string;
  redirectPath: string;
}

export interface DeleteIncomeDeductionInput {
  year: number;
  type: string;
  redirectPath: string;
}

export interface IncomeDeductionActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

function requireIncomeDeductionType(type: string): IncomeDeductionType {
  if (!isIncomeDeductionType(type)) {
    throw new Error(`不正な所得控除区分です: ${type}`);
  }
  return type;
}

export async function saveIncomeDeductionCore(
  taxYearRepository: TaxYearRepository,
  incomeDeductionRepository: IncomeDeductionRepository,
  input: SaveIncomeDeductionInput,
): Promise<IncomeDeductionActionResult> {
  const type = requireIncomeDeductionType(input.type);
  const { year, incomeTaxAmountJpy, residentTaxAmountJpy, redirectPath } = input;

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await incomeDeductionRepository.upsert({
    taxYearId: taxYear.id,
    type,
    incomeTaxAmountJpy,
    residentTaxAmountJpy,
  });

  return { redirectTo: `${redirectPath}?year=${year}&deductionSaved=${type}` };
}

export async function deleteIncomeDeductionCore(
  taxYearRepository: TaxYearRepository,
  incomeDeductionRepository: IncomeDeductionRepository,
  input: DeleteIncomeDeductionInput,
): Promise<IncomeDeductionActionResult> {
  const type = requireIncomeDeductionType(input.type);
  const { year, redirectPath } = input;

  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await incomeDeductionRepository.deleteByTaxYearIdAndType(taxYear.id, type);
  }

  return { redirectTo: `${redirectPath}?year=${year}&deductionDeleted=${type}` };
}
