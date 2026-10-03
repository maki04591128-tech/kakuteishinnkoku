/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`saveMortgageDeductionRecord`/
 * `deleteMortgageDeductionRecord`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(リポジトリ呼び出し・次の遷移先の
 * 決定)をコア関数として切り出した。3-12〜3-21の`save*Record`/`delete*Record`群と
 * 同じく「発生年」の入力・バリデーションが無い単純な年単位レコードの登録/削除であり、
 * 削除時はリポジトリの`delete(id)`ではなく`findByYear`で対象年のTaxYearを取得した上で
 * `deleteByTaxYearId`を呼ぶ(対象のTaxYearが無い場合は何もしない。従来の`actions.ts`
 * 実装と同一の挙動)。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { MortgageDeductionRecordRepository } from "@/lib/repositories/mortgageDeductionRecordRepository";

export interface SaveMortgageDeductionRecordInput {
  year: number;
  nationalTaxCreditJpy: string;
  residentTaxCreditJpy: string;
}

export interface DeleteMortgageDeductionRecordInput {
  year: number;
}

export interface MortgageDeductionRecordActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function saveMortgageDeductionRecordCore(
  taxYearRepository: TaxYearRepository,
  mortgageDeductionRecordRepository: MortgageDeductionRecordRepository,
  input: SaveMortgageDeductionRecordInput,
): Promise<MortgageDeductionRecordActionResult> {
  const { year, nationalTaxCreditJpy, residentTaxCreditJpy } = input;

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await mortgageDeductionRecordRepository.upsert({
    taxYearId: taxYear.id,
    nationalTaxCreditJpy,
    residentTaxCreditJpy,
  });

  return { redirectTo: `/mortgage-deduction?year=${year}&mortgageDeductionSaved=1` };
}

export async function deleteMortgageDeductionRecordCore(
  taxYearRepository: TaxYearRepository,
  mortgageDeductionRecordRepository: MortgageDeductionRecordRepository,
  input: DeleteMortgageDeductionRecordInput,
): Promise<MortgageDeductionRecordActionResult> {
  const { year } = input;

  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await mortgageDeductionRecordRepository.deleteByTaxYearId(taxYear.id);
  }

  return { redirectTo: `/mortgage-deduction?year=${year}&mortgageDeductionDeleted=1` };
}
