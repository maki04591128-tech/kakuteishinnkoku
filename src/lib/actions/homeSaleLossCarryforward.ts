/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`setHomeSaleLossCarryforward`/
 * `deleteHomeSaleLossCarryforward`から、Next.js固有のAPI(`revalidatePath`/
 * `redirect`)に依存しない部分(入力検証・リポジトリ呼び出し・次の遷移先の決定)を
 * コア関数として切り出した。3-5の`setAngelTaxLossCarryforward`・3-6の
 * `setFuturesLossCarryforward`・3-7の`setCasualtyLossCarryforward`に続き、
 * `getOrCreateTaxYear`(`TaxYearRepository`)と個別の繰越控除リポジトリ
 * (`HomeSaleLossCarryforwardRepository`)の2つに依存する構成の4例目。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { HomeSaleLossCarryforwardRepository } from "@/lib/repositories/homeSaleLossCarryforwardRepository";

export interface SetHomeSaleLossCarryforwardInput {
  year: number;
  originYear: number;
  remainingAmountJpy: string;
}

export interface DeleteHomeSaleLossCarryforwardInput {
  id: number;
  year: number;
}

export interface HomeSaleLossCarryforwardActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function setHomeSaleLossCarryforwardCore(
  taxYearRepository: TaxYearRepository,
  homeSaleLossCarryforwardRepository: HomeSaleLossCarryforwardRepository,
  input: SetHomeSaleLossCarryforwardInput,
): Promise<HomeSaleLossCarryforwardActionResult> {
  const { year, originYear, remainingAmountJpy } = input;
  if (!Number.isInteger(originYear) || originYear > year) {
    throw new Error("譲渡損失の発生年は対象年分以前の年である必要があります");
  }

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await homeSaleLossCarryforwardRepository.upsert({
    taxYearId: taxYear.id,
    originYear,
    remainingAmountJpy,
  });

  return { redirectTo: `/import?year=${year}&tab=homeSaleLossCarryforward` };
}

export async function deleteHomeSaleLossCarryforwardCore(
  homeSaleLossCarryforwardRepository: HomeSaleLossCarryforwardRepository,
  input: DeleteHomeSaleLossCarryforwardInput,
): Promise<HomeSaleLossCarryforwardActionResult> {
  const { id, year } = input;

  await homeSaleLossCarryforwardRepository.delete(id);

  return { redirectTo: `/import?year=${year}&tab=homeSaleLossCarryforward` };
}
