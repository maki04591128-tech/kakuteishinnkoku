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

export interface CarryForwardCasualtyLossExcessInput {
  year: number;
  entries: { originYear: number; remainingAmountJpy: string }[];
}

export interface CarryForwardCasualtyLossExcessResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

/**
 * フェーズ5-1-3d-14: `src/app/actions.ts`の`carryForwardCasualtyLossExcess`から
 * コア部分を切り出した(`setCasualtyLossCarryforwardCore`等と同じ理由)。
 * 雑損控除の試算画面(/casualty-loss-deduction)の当年分の計算結果のうち、
 * 翌年以後に繰り越す雑損失額(発生年ごと)を、翌年分のCasualtyLossCarryforwardとして
 * まとめて登録する(既に翌年分に同じ発生年の登録がある場合は上書きしない)。
 */
export async function carryForwardCasualtyLossExcessCore(
  taxYearRepository: TaxYearRepository,
  casualtyLossCarryforwardRepository: CasualtyLossCarryforwardRepository,
  input: CarryForwardCasualtyLossExcessInput,
): Promise<CarryForwardCasualtyLossExcessResult> {
  const { year, entries } = input;

  const nextTaxYear = await taxYearRepository.getOrCreateTaxYear(year + 1);
  const existing = await casualtyLossCarryforwardRepository.findByTaxYearId(nextTaxYear.id);
  const existingYears = new Set(existing.map((e) => e.originYear));
  const toCreate = entries.filter((e) => !existingYears.has(e.originYear));

  await casualtyLossCarryforwardRepository.createMany(
    toCreate.map((e) => ({
      taxYearId: nextTaxYear.id,
      originYear: e.originYear,
      remainingAmountJpy: e.remainingAmountJpy,
    })),
  );

  return { redirectTo: `/casualty-loss-deduction?year=${year}&lossCarried=${toCreate.length}` };
}
