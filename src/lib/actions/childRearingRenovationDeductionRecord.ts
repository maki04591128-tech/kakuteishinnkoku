/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`saveChildRearingRenovationDeductionRecord`/
 * `deleteChildRearingRenovationDeductionRecord`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(リポジトリ呼び出し・次の遷移先の
 * 決定)をコア関数として切り出した。3-16の`DurabilityImprovementRenovationDeductionRecord`と
 * 同じく「発生年」の入力・バリデーションが無い単純な年単位レコードの登録/削除であり、
 * 削除時はリポジトリの`delete(id)`ではなく`findByYear`で対象年のTaxYearを取得した上で
 * `deleteByTaxYearId`を呼ぶ(対象のTaxYearが無い場合は何もしない。従来の`actions.ts`
 * 実装と同一の挙動)。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { ChildRearingRenovationDeductionRecordRepository } from "@/lib/repositories/childRearingRenovationDeductionRecordRepository";

export interface SaveChildRearingRenovationDeductionRecordInput {
  year: number;
  creditJpy: string;
}

export interface DeleteChildRearingRenovationDeductionRecordInput {
  year: number;
}

export interface ChildRearingRenovationDeductionRecordActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function saveChildRearingRenovationDeductionRecordCore(
  taxYearRepository: TaxYearRepository,
  childRearingRenovationDeductionRecordRepository: ChildRearingRenovationDeductionRecordRepository,
  input: SaveChildRearingRenovationDeductionRecordInput,
): Promise<ChildRearingRenovationDeductionRecordActionResult> {
  const { year, creditJpy } = input;

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await childRearingRenovationDeductionRecordRepository.upsert({
    taxYearId: taxYear.id,
    creditJpy,
  });

  return { redirectTo: `/child-rearing-renovation-deduction?year=${year}&saved=1` };
}

export async function deleteChildRearingRenovationDeductionRecordCore(
  taxYearRepository: TaxYearRepository,
  childRearingRenovationDeductionRecordRepository: ChildRearingRenovationDeductionRecordRepository,
  input: DeleteChildRearingRenovationDeductionRecordInput,
): Promise<ChildRearingRenovationDeductionRecordActionResult> {
  const { year } = input;

  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await childRearingRenovationDeductionRecordRepository.deleteByTaxYearId(taxYear.id);
  }

  return { redirectTo: `/child-rearing-renovation-deduction?year=${year}&deleted=1` };
}
