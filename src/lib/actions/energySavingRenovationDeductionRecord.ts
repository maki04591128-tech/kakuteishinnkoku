/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`saveEnergySavingRenovationDeductionRecord`/
 * `deleteEnergySavingRenovationDeductionRecord`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(リポジトリ呼び出し・次の遷移先の
 * 決定)をコア関数として切り出した。3-12の`EarthquakeRenovationDeductionRecord`と
 * 同じく「発生年」の入力・バリデーションが無い単純な年単位レコードの登録/削除であり、
 * 削除時はリポジトリの`delete(id)`ではなく`findByYear`で対象年のTaxYearを取得した上で
 * `deleteByTaxYearId`を呼ぶ(対象のTaxYearが無い場合は何もしない。従来の
 * `actions.ts`実装と同一の挙動)。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { EnergySavingRenovationDeductionRecordRepository } from "@/lib/repositories/energySavingRenovationDeductionRecordRepository";

export interface SaveEnergySavingRenovationDeductionRecordInput {
  year: number;
  creditJpy: string;
}

export interface DeleteEnergySavingRenovationDeductionRecordInput {
  year: number;
}

export interface EnergySavingRenovationDeductionRecordActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function saveEnergySavingRenovationDeductionRecordCore(
  taxYearRepository: TaxYearRepository,
  energySavingRenovationDeductionRecordRepository: EnergySavingRenovationDeductionRecordRepository,
  input: SaveEnergySavingRenovationDeductionRecordInput,
): Promise<EnergySavingRenovationDeductionRecordActionResult> {
  const { year, creditJpy } = input;

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await energySavingRenovationDeductionRecordRepository.upsert({
    taxYearId: taxYear.id,
    creditJpy,
  });

  return { redirectTo: `/energy-saving-renovation-deduction?year=${year}&saved=1` };
}

export async function deleteEnergySavingRenovationDeductionRecordCore(
  taxYearRepository: TaxYearRepository,
  energySavingRenovationDeductionRecordRepository: EnergySavingRenovationDeductionRecordRepository,
  input: DeleteEnergySavingRenovationDeductionRecordInput,
): Promise<EnergySavingRenovationDeductionRecordActionResult> {
  const { year } = input;

  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await energySavingRenovationDeductionRecordRepository.deleteByTaxYearId(taxYear.id);
  }

  return { redirectTo: `/energy-saving-renovation-deduction?year=${year}&deleted=1` };
}
