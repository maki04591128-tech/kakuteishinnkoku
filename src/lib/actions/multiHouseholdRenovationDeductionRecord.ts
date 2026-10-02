/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`saveMultiHouseholdRenovationDeductionRecord`/
 * `deleteMultiHouseholdRenovationDeductionRecord`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(リポジトリ呼び出し・次の遷移先の
 * 決定)をコア関数として切り出した。3-12〜3-14の
 * `EarthquakeRenovationDeductionRecord`/`EnergySavingRenovationDeductionRecord`/
 * `BarrierFreeRenovationDeductionRecord`と同じく「発生年」の入力・バリデーションが
 * 無い単純な年単位レコードの登録/削除であり、削除時はリポジトリの`delete(id)`ではなく
 * `findByYear`で対象年のTaxYearを取得した上で`deleteByTaxYearId`を呼ぶ(対象の
 * TaxYearが無い場合は何もしない。従来の`actions.ts`実装と同一の挙動)。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { MultiHouseholdRenovationDeductionRecordRepository } from "@/lib/repositories/multiHouseholdRenovationDeductionRecordRepository";

export interface SaveMultiHouseholdRenovationDeductionRecordInput {
  year: number;
  creditJpy: string;
}

export interface DeleteMultiHouseholdRenovationDeductionRecordInput {
  year: number;
}

export interface MultiHouseholdRenovationDeductionRecordActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function saveMultiHouseholdRenovationDeductionRecordCore(
  taxYearRepository: TaxYearRepository,
  multiHouseholdRenovationDeductionRecordRepository: MultiHouseholdRenovationDeductionRecordRepository,
  input: SaveMultiHouseholdRenovationDeductionRecordInput,
): Promise<MultiHouseholdRenovationDeductionRecordActionResult> {
  const { year, creditJpy } = input;

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await multiHouseholdRenovationDeductionRecordRepository.upsert({
    taxYearId: taxYear.id,
    creditJpy,
  });

  return { redirectTo: `/multi-household-renovation-deduction?year=${year}&saved=1` };
}

export async function deleteMultiHouseholdRenovationDeductionRecordCore(
  taxYearRepository: TaxYearRepository,
  multiHouseholdRenovationDeductionRecordRepository: MultiHouseholdRenovationDeductionRecordRepository,
  input: DeleteMultiHouseholdRenovationDeductionRecordInput,
): Promise<MultiHouseholdRenovationDeductionRecordActionResult> {
  const { year } = input;

  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await multiHouseholdRenovationDeductionRecordRepository.deleteByTaxYearId(taxYear.id);
  }

  return { redirectTo: `/multi-household-renovation-deduction?year=${year}&deleted=1` };
}
