/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`setLossCarryforward`/`deleteLossCarryforward`から、
 * Next.js固有のAPI(`revalidatePath`/`redirect`)に依存しない部分(入力検証・
 * リポジトリ呼び出し・次の遷移先の決定)をコア関数として切り出した。3-5の
 * `setAngelTaxLossCarryforward`と同じ`TaxYearRepository`と
 * `InvestmentLossCarryforwardRepository`の2つに依存するパターン。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { InvestmentLossCarryforwardRepository } from "@/lib/repositories/investmentLossCarryforwardRepository";

export interface SetInvestmentLossCarryforwardInput {
  year: number;
  originYear: number;
  remainingAmountJpy: string;
}

export interface DeleteInvestmentLossCarryforwardInput {
  id: number;
  year: number;
}

export interface InvestmentLossCarryforwardActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function setInvestmentLossCarryforwardCore(
  taxYearRepository: TaxYearRepository,
  investmentLossCarryforwardRepository: InvestmentLossCarryforwardRepository,
  input: SetInvestmentLossCarryforwardInput,
): Promise<InvestmentLossCarryforwardActionResult> {
  const { year, originYear, remainingAmountJpy } = input;
  if (!Number.isInteger(originYear) || originYear > year) {
    throw new Error("損失の発生年は対象年分以前の年である必要があります");
  }

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await investmentLossCarryforwardRepository.upsert({
    taxYearId: taxYear.id,
    originYear,
    remainingAmountJpy,
  });

  return { redirectTo: `/import?year=${year}&tab=lossCarryforward` };
}

export async function deleteInvestmentLossCarryforwardCore(
  investmentLossCarryforwardRepository: InvestmentLossCarryforwardRepository,
  input: DeleteInvestmentLossCarryforwardInput,
): Promise<InvestmentLossCarryforwardActionResult> {
  const { id, year } = input;

  await investmentLossCarryforwardRepository.delete(id);

  return { redirectTo: `/import?year=${year}&tab=lossCarryforward` };
}
