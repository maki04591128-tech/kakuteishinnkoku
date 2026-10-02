/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`setCasualtyLossCarryforward`/
 * `deleteCasualtyLossCarryforward`から、Next.js固有のAPI(`revalidatePath`/
 * `redirect`)に依存しない部分(入力検証・リポジトリ呼び出し・次の遷移先の決定)を
 * コア関数として切り出した。3-5の`setAngelTaxLossCarryforward`・3-6の
 * `setFuturesLossCarryforward`に続き、`getOrCreateTaxYear`
 * (`TaxYearRepository`)と個別の繰越控除リポジトリ
 * (`CasualtyLossCarryforwardRepository`)の2つに依存する構成の3例目。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { CasualtyLossCarryforwardRepository } from "@/lib/repositories/casualtyLossCarryforwardRepository";

export interface SetCasualtyLossCarryforwardInput {
  year: number;
  originYear: number;
  remainingAmountJpy: string;
}

export interface DeleteCasualtyLossCarryforwardInput {
  id: number;
  year: number;
}

export interface CasualtyLossCarryforwardActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function setCasualtyLossCarryforwardCore(
  taxYearRepository: TaxYearRepository,
  casualtyLossCarryforwardRepository: CasualtyLossCarryforwardRepository,
  input: SetCasualtyLossCarryforwardInput,
): Promise<CasualtyLossCarryforwardActionResult> {
  const { year, originYear, remainingAmountJpy } = input;
  if (!Number.isInteger(originYear) || originYear > year) {
    throw new Error("雑損失の発生年は対象年分以前の年である必要があります");
  }

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await casualtyLossCarryforwardRepository.upsert({
    taxYearId: taxYear.id,
    originYear,
    remainingAmountJpy,
  });

  return { redirectTo: `/import?year=${year}&tab=casualtyLossCarryforward` };
}

export async function deleteCasualtyLossCarryforwardCore(
  casualtyLossCarryforwardRepository: CasualtyLossCarryforwardRepository,
  input: DeleteCasualtyLossCarryforwardInput,
): Promise<CasualtyLossCarryforwardActionResult> {
  const { id, year } = input;

  await casualtyLossCarryforwardRepository.delete(id);

  return { redirectTo: `/import?year=${year}&tab=casualtyLossCarryforward` };
}
