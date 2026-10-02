/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`setHomeReplacementLossCarryforward`/
 * `deleteHomeReplacementLossCarryforward`から、Next.js固有のAPI(`revalidatePath`/
 * `redirect`)に依存しない部分(入力検証・リポジトリ呼び出し・次の遷移先の決定)を
 * コア関数として切り出した。3-5の`setAngelTaxLossCarryforward`・3-6の
 * `setFuturesLossCarryforward`・3-7の`setCasualtyLossCarryforward`・3-8の
 * `setHomeSaleLossCarryforward`に続き、`getOrCreateTaxYear`
 * (`TaxYearRepository`)と個別の繰越控除リポジトリ
 * (`HomeReplacementLossCarryforwardRepository`)の2つに依存する構成の5例目
 * (ロジックは3-8と同一パターン)。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { HomeReplacementLossCarryforwardRepository } from "@/lib/repositories/homeReplacementLossCarryforwardRepository";

export interface SetHomeReplacementLossCarryforwardInput {
  year: number;
  originYear: number;
  remainingAmountJpy: string;
}

export interface DeleteHomeReplacementLossCarryforwardInput {
  id: number;
  year: number;
}

export interface HomeReplacementLossCarryforwardActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function setHomeReplacementLossCarryforwardCore(
  taxYearRepository: TaxYearRepository,
  homeReplacementLossCarryforwardRepository: HomeReplacementLossCarryforwardRepository,
  input: SetHomeReplacementLossCarryforwardInput,
): Promise<HomeReplacementLossCarryforwardActionResult> {
  const { year, originYear, remainingAmountJpy } = input;
  if (!Number.isInteger(originYear) || originYear > year) {
    throw new Error("譲渡損失の発生年は対象年分以前の年である必要があります");
  }

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await homeReplacementLossCarryforwardRepository.upsert({
    taxYearId: taxYear.id,
    originYear,
    remainingAmountJpy,
  });

  return { redirectTo: `/import?year=${year}&tab=homeReplacementLossCarryforward` };
}

export async function deleteHomeReplacementLossCarryforwardCore(
  homeReplacementLossCarryforwardRepository: HomeReplacementLossCarryforwardRepository,
  input: DeleteHomeReplacementLossCarryforwardInput,
): Promise<HomeReplacementLossCarryforwardActionResult> {
  const { id, year } = input;

  await homeReplacementLossCarryforwardRepository.delete(id);

  return { redirectTo: `/import?year=${year}&tab=homeReplacementLossCarryforward` };
}
