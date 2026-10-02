/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`saveDonationTaxCreditRecord`/
 * `deleteDonationTaxCreditRecord`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(リポジトリ呼び出し・次の遷移先の
 * 決定)をコア関数として切り出した。3-12〜3-19の`save*Record`/`delete*Record`群と
 * 同じく「発生年」の入力・バリデーションが無い単純な年単位レコードの登録/削除であり、
 * 削除時はリポジトリの`delete(id)`ではなく`findByYear`で対象年のTaxYearを取得した上で
 * `deleteByTaxYearId`を呼ぶ(対象のTaxYearが無い場合は何もしない。従来の`actions.ts`
 * 実装と同一の挙動)。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { DonationTaxCreditRecordRepository } from "@/lib/repositories/donationTaxCreditRecordRepository";

export interface SaveDonationTaxCreditRecordInput {
  year: number;
  totalTaxCreditJpy: string;
  residentTaxBasicDeductionJpy: string;
}

export interface DeleteDonationTaxCreditRecordInput {
  year: number;
}

export interface DonationTaxCreditRecordActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function saveDonationTaxCreditRecordCore(
  taxYearRepository: TaxYearRepository,
  donationTaxCreditRecordRepository: DonationTaxCreditRecordRepository,
  input: SaveDonationTaxCreditRecordInput,
): Promise<DonationTaxCreditRecordActionResult> {
  const { year, totalTaxCreditJpy, residentTaxBasicDeductionJpy } = input;

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await donationTaxCreditRecordRepository.upsert({
    taxYearId: taxYear.id,
    totalTaxCreditJpy,
    residentTaxBasicDeductionJpy,
  });

  return { redirectTo: `/donation-tax-credit?year=${year}&donationTaxCreditSaved=1` };
}

export async function deleteDonationTaxCreditRecordCore(
  taxYearRepository: TaxYearRepository,
  donationTaxCreditRecordRepository: DonationTaxCreditRecordRepository,
  input: DeleteDonationTaxCreditRecordInput,
): Promise<DonationTaxCreditRecordActionResult> {
  const { year } = input;

  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await donationTaxCreditRecordRepository.deleteByTaxYearId(taxYear.id);
  }

  return { redirectTo: `/donation-tax-credit?year=${year}&donationTaxCreditDeleted=1` };
}
