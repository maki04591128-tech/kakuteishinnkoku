/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`setForeignTaxCreditSpareLimitCarryforward`/
 * `deleteForeignTaxCreditSpareLimitCarryforward`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(入力検証・リポジトリ呼び出し・
 * 次の遷移先の決定)をコア関数として切り出した。3-10
 * (`setForeignTaxCreditCarryforward`)に続き、`getOrCreateTaxYear`
 * (`TaxYearRepository`)と個別の繰越控除リポジトリ
 * (`ForeignTaxCreditSpareLimitCarryforwardRepository`)の2つに依存する構成の
 * 7例目(ロジックは3-5〜3-10と同一パターン)。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { ForeignTaxCreditSpareLimitCarryforwardRepository } from "@/lib/repositories/foreignTaxCreditSpareLimitCarryforwardRepository";

export interface SetForeignTaxCreditSpareLimitCarryforwardInput {
  year: number;
  originYear: number;
  remainingAmountJpy: string;
}

export interface DeleteForeignTaxCreditSpareLimitCarryforwardInput {
  id: number;
  year: number;
}

export interface ForeignTaxCreditSpareLimitCarryforwardActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function setForeignTaxCreditSpareLimitCarryforwardCore(
  taxYearRepository: TaxYearRepository,
  foreignTaxCreditSpareLimitCarryforwardRepository: ForeignTaxCreditSpareLimitCarryforwardRepository,
  input: SetForeignTaxCreditSpareLimitCarryforwardInput,
): Promise<ForeignTaxCreditSpareLimitCarryforwardActionResult> {
  const { year, originYear, remainingAmountJpy } = input;
  if (!Number.isInteger(originYear) || originYear > year) {
    throw new Error("控除余裕額の発生年は対象年分以前の年である必要があります");
  }

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await foreignTaxCreditSpareLimitCarryforwardRepository.upsert({
    taxYearId: taxYear.id,
    originYear,
    remainingAmountJpy,
  });

  return { redirectTo: `/import?year=${year}&tab=foreignTaxCredit` };
}

export async function deleteForeignTaxCreditSpareLimitCarryforwardCore(
  foreignTaxCreditSpareLimitCarryforwardRepository: ForeignTaxCreditSpareLimitCarryforwardRepository,
  input: DeleteForeignTaxCreditSpareLimitCarryforwardInput,
): Promise<ForeignTaxCreditSpareLimitCarryforwardActionResult> {
  const { id, year } = input;

  await foreignTaxCreditSpareLimitCarryforwardRepository.delete(id);

  return { redirectTo: `/import?year=${year}&tab=foreignTaxCredit` };
}
