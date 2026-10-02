/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`saveForeignTaxCreditRecord`/
 * `deleteForeignTaxCreditRecord`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(リポジトリ呼び出し・次の遷移先の
 * 決定)をコア関数として切り出した。3-12〜3-18の`save*Record`/`delete*Record`群と
 * 同じく「発生年」の入力・バリデーションが無い単純な年単位レコードの登録/削除であり、
 * 削除時はリポジトリの`delete(id)`ではなく`findByYear`で対象年のTaxYearを取得した上で
 * `deleteByTaxYearId`を呼ぶ(対象のTaxYearが無い場合は何もしない。従来の`actions.ts`
 * 実装と同一の挙動)。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { ForeignTaxCreditRecordRepository } from "@/lib/repositories/foreignTaxCreditRecordRepository";

export interface SaveForeignTaxCreditRecordInput {
  year: number;
  totalCreditJpy: string;
  nationalTaxCreditJpy: string;
  residentTaxCreditJpy: string;
}

export interface DeleteForeignTaxCreditRecordInput {
  year: number;
}

export interface ForeignTaxCreditRecordActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function saveForeignTaxCreditRecordCore(
  taxYearRepository: TaxYearRepository,
  foreignTaxCreditRecordRepository: ForeignTaxCreditRecordRepository,
  input: SaveForeignTaxCreditRecordInput,
): Promise<ForeignTaxCreditRecordActionResult> {
  const { year, totalCreditJpy, nationalTaxCreditJpy, residentTaxCreditJpy } = input;

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await foreignTaxCreditRecordRepository.upsert({
    taxYearId: taxYear.id,
    totalCreditJpy,
    nationalTaxCreditJpy,
    residentTaxCreditJpy,
  });

  return { redirectTo: `/foreign-tax-credit?year=${year}&foreignTaxCreditSaved=1` };
}

export async function deleteForeignTaxCreditRecordCore(
  taxYearRepository: TaxYearRepository,
  foreignTaxCreditRecordRepository: ForeignTaxCreditRecordRepository,
  input: DeleteForeignTaxCreditRecordInput,
): Promise<ForeignTaxCreditRecordActionResult> {
  const { year } = input;

  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await foreignTaxCreditRecordRepository.deleteByTaxYearId(taxYear.id);
  }

  return { redirectTo: `/foreign-tax-credit?year=${year}&foreignTaxCreditDeleted=1` };
}
