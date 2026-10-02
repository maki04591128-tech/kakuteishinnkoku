/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`saveEarthquakeRenovationDeductionRecord`/
 * `deleteEarthquakeRenovationDeductionRecord`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(入力検証・リポジトリ呼び出し・
 * 次の遷移先の決定)をコア関数として切り出した。3-5〜3-11の繰越控除系アクション
 * (`getOrCreateTaxYear`+個別リポジトリの2依存構成)とは異なり、本アクションは
 * 「発生年」の入力・バリデーションが無い単純な年単位レコードの登録/削除であり、
 * 削除時はリポジトリの`delete(id)`ではなく`findByYear`で対象年のTaxYearを取得した上で
 * `deleteByTaxYearId`を呼ぶ(対象のTaxYearが無い場合は何もしない。従来の
 * `actions.ts`実装と同一の挙動)。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { EarthquakeRenovationDeductionRecordRepository } from "@/lib/repositories/earthquakeRenovationDeductionRecordRepository";

export interface SaveEarthquakeRenovationDeductionRecordInput {
  year: number;
  creditJpy: string;
}

export interface DeleteEarthquakeRenovationDeductionRecordInput {
  year: number;
}

export interface EarthquakeRenovationDeductionRecordActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function saveEarthquakeRenovationDeductionRecordCore(
  taxYearRepository: TaxYearRepository,
  earthquakeRenovationDeductionRecordRepository: EarthquakeRenovationDeductionRecordRepository,
  input: SaveEarthquakeRenovationDeductionRecordInput,
): Promise<EarthquakeRenovationDeductionRecordActionResult> {
  const { year, creditJpy } = input;

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await earthquakeRenovationDeductionRecordRepository.upsert({
    taxYearId: taxYear.id,
    creditJpy,
  });

  return { redirectTo: `/earthquake-renovation-deduction?year=${year}&saved=1` };
}

export async function deleteEarthquakeRenovationDeductionRecordCore(
  taxYearRepository: TaxYearRepository,
  earthquakeRenovationDeductionRecordRepository: EarthquakeRenovationDeductionRecordRepository,
  input: DeleteEarthquakeRenovationDeductionRecordInput,
): Promise<EarthquakeRenovationDeductionRecordActionResult> {
  const { year } = input;

  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await earthquakeRenovationDeductionRecordRepository.deleteByTaxYearId(taxYear.id);
  }

  return { redirectTo: `/earthquake-renovation-deduction?year=${year}&deleted=1` };
}
