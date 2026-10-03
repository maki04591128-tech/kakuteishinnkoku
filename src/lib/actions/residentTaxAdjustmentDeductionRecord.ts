/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`saveResidentTaxAdjustmentDeductionRecord`/
 * `deleteResidentTaxAdjustmentDeductionRecord`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(入力検証・リポジトリ呼び出し・
 * 次の遷移先の決定)をコア関数として切り出した。3-12〜3-22の「発生年の入力・
 * バリデーションが無い単純な年単位レコードの登録/削除」パターンと同様だが、
 * 遷移先のクエリパラメータ名が`saved`/`deleted`ではなく
 * `residentTaxAdjustmentDeductionSaved`/`residentTaxAdjustmentDeductionDeleted`
 * である点のみ既存実装(`actions.ts`)の挙動を引き継いでいる。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { ResidentTaxAdjustmentDeductionRecordRepository } from "@/lib/repositories/residentTaxAdjustmentDeductionRecordRepository";

export interface SaveResidentTaxAdjustmentDeductionRecordInput {
  year: number;
  adjustmentDeductionJpy: string;
}

export interface DeleteResidentTaxAdjustmentDeductionRecordInput {
  year: number;
}

export interface ResidentTaxAdjustmentDeductionRecordActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function saveResidentTaxAdjustmentDeductionRecordCore(
  taxYearRepository: TaxYearRepository,
  residentTaxAdjustmentDeductionRecordRepository: ResidentTaxAdjustmentDeductionRecordRepository,
  input: SaveResidentTaxAdjustmentDeductionRecordInput,
): Promise<ResidentTaxAdjustmentDeductionRecordActionResult> {
  const { year, adjustmentDeductionJpy } = input;

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await residentTaxAdjustmentDeductionRecordRepository.upsert({
    taxYearId: taxYear.id,
    adjustmentDeductionJpy,
  });

  return {
    redirectTo: `/resident-tax-adjustment-deduction?year=${year}&residentTaxAdjustmentDeductionSaved=1`,
  };
}

export async function deleteResidentTaxAdjustmentDeductionRecordCore(
  taxYearRepository: TaxYearRepository,
  residentTaxAdjustmentDeductionRecordRepository: ResidentTaxAdjustmentDeductionRecordRepository,
  input: DeleteResidentTaxAdjustmentDeductionRecordInput,
): Promise<ResidentTaxAdjustmentDeductionRecordActionResult> {
  const { year } = input;

  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await residentTaxAdjustmentDeductionRecordRepository.deleteByTaxYearId(taxYear.id);
  }

  return {
    redirectTo: `/resident-tax-adjustment-deduction?year=${year}&residentTaxAdjustmentDeductionDeleted=1`,
  };
}
