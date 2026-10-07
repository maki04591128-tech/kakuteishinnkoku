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

export interface CarryForwardHomeSaleLossExcessInput {
  year: number;
  entries: { originYear: number; remainingAmountJpy: string }[];
}

export interface CarryForwardHomeSaleLossExcessResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

/**
 * フェーズ5-1-3d-17: `src/app/actions.ts`の`carryForwardHomeSaleLossExcess`から
 * コア部分を切り出した(`carryForwardCasualtyLossExcessCore`等と同じ理由)。
 * 特定居住用財産の譲渡損失の損益通算及び繰越控除の試算画面
 * (/home-sale-loss-deduction)の当年分の計算結果のうち、翌年以後に繰り越す
 * 譲渡損失額(発生年ごと)を、翌年分のHomeSaleLossCarryforwardとしてまとめて
 * 登録する(既に翌年分に同じ発生年の登録がある場合は上書きしない)。
 */
export async function carryForwardHomeSaleLossExcessCore(
  taxYearRepository: TaxYearRepository,
  homeSaleLossCarryforwardRepository: HomeSaleLossCarryforwardRepository,
  input: CarryForwardHomeSaleLossExcessInput,
): Promise<CarryForwardHomeSaleLossExcessResult> {
  const { year, entries } = input;

  const nextTaxYear = await taxYearRepository.getOrCreateTaxYear(year + 1);
  const existing = await homeSaleLossCarryforwardRepository.findByTaxYearId(nextTaxYear.id);
  const existingYears = new Set(existing.map((e) => e.originYear));
  const toCreate = entries.filter((e) => !existingYears.has(e.originYear));

  await homeSaleLossCarryforwardRepository.createMany(
    toCreate.map((e) => ({
      taxYearId: nextTaxYear.id,
      originYear: e.originYear,
      remainingAmountJpy: e.remainingAmountJpy,
    })),
  );

  return { redirectTo: `/home-sale-loss-deduction?year=${year}&lossCarried=${toCreate.length}` };
}
