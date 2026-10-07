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

export interface CarryForwardHomeReplacementLossExcessInput {
  year: number;
  entries: { originYear: number; remainingAmountJpy: string }[];
}

export interface CarryForwardHomeReplacementLossExcessResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

/**
 * フェーズ5-1-3d-18: `src/app/actions.ts`の`carryForwardHomeReplacementLossExcess`から
 * コア部分を切り出した(`carryForwardHomeSaleLossExcessCore`等と同じ理由)。
 * 居住用財産の買換え等の場合の譲渡損失の損益通算及び繰越控除の試算画面
 * (/home-replacement-loss-deduction)の当年分の計算結果のうち、翌年以後に繰り越す
 * 譲渡損失額(発生年ごと)を、翌年分のHomeReplacementLossCarryforwardとしてまとめて
 * 登録する(既に翌年分に同じ発生年の登録がある場合は上書きしない)。
 */
export async function carryForwardHomeReplacementLossExcessCore(
  taxYearRepository: TaxYearRepository,
  homeReplacementLossCarryforwardRepository: HomeReplacementLossCarryforwardRepository,
  input: CarryForwardHomeReplacementLossExcessInput,
): Promise<CarryForwardHomeReplacementLossExcessResult> {
  const { year, entries } = input;

  const nextTaxYear = await taxYearRepository.getOrCreateTaxYear(year + 1);
  const existing =
    await homeReplacementLossCarryforwardRepository.findByTaxYearId(nextTaxYear.id);
  const existingYears = new Set(existing.map((e) => e.originYear));
  const toCreate = entries.filter((e) => !existingYears.has(e.originYear));

  await homeReplacementLossCarryforwardRepository.createMany(
    toCreate.map((e) => ({
      taxYearId: nextTaxYear.id,
      originYear: e.originYear,
      remainingAmountJpy: e.remainingAmountJpy,
    })),
  );

  return {
    redirectTo: `/home-replacement-loss-deduction?year=${year}&lossCarried=${toCreate.length}`,
  };
}
