/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`saveDistributionAdjustedForeignTaxCreditRecord`/
 * `deleteDistributionAdjustedForeignTaxCreditRecord`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(入力検証・リポジトリ呼び出し・
 * 次の遷移先の決定)をコア関数として切り出した。3-20までの「控除額を登録する
 * 単純な年単位レコード」系と同じ構成(`getOrCreateTaxYear`+個別リポジトリの2依存、
 * 削除時は`findByYear`で対象年のTaxYearを取得した上で存在する場合のみ
 * `deleteByTaxYearId`を呼ぶ)。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { DistributionAdjustedForeignTaxCreditRecordRepository } from "@/lib/repositories/distributionAdjustedForeignTaxCreditRecordRepository";

export interface SaveDistributionAdjustedForeignTaxCreditRecordInput {
  year: number;
  creditJpy: string;
}

export interface DeleteDistributionAdjustedForeignTaxCreditRecordInput {
  year: number;
}

export interface DistributionAdjustedForeignTaxCreditRecordActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function saveDistributionAdjustedForeignTaxCreditRecordCore(
  taxYearRepository: TaxYearRepository,
  distributionAdjustedForeignTaxCreditRecordRepository: DistributionAdjustedForeignTaxCreditRecordRepository,
  input: SaveDistributionAdjustedForeignTaxCreditRecordInput,
): Promise<DistributionAdjustedForeignTaxCreditRecordActionResult> {
  const { year, creditJpy } = input;

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await distributionAdjustedForeignTaxCreditRecordRepository.upsert({
    taxYearId: taxYear.id,
    creditJpy,
  });

  return { redirectTo: `/distribution-adjusted-foreign-tax-credit?year=${year}&saved=1` };
}

export async function deleteDistributionAdjustedForeignTaxCreditRecordCore(
  taxYearRepository: TaxYearRepository,
  distributionAdjustedForeignTaxCreditRecordRepository: DistributionAdjustedForeignTaxCreditRecordRepository,
  input: DeleteDistributionAdjustedForeignTaxCreditRecordInput,
): Promise<DistributionAdjustedForeignTaxCreditRecordActionResult> {
  const { year } = input;

  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await distributionAdjustedForeignTaxCreditRecordRepository.deleteByTaxYearId(taxYear.id);
  }

  return { redirectTo: `/distribution-adjusted-foreign-tax-credit?year=${year}&deleted=1` };
}
