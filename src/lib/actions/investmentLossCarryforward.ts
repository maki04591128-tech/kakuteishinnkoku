/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`setLossCarryforward`/`deleteLossCarryforward`から、
 * Next.js固有のAPI(`revalidatePath`/`redirect`)に依存しない部分(入力検証・
 * リポジトリ呼び出し・次の遷移先の決定)をコア関数として切り出した。3-5の
 * `setAngelTaxLossCarryforward`と同じ`TaxYearRepository`と
 * `InvestmentLossCarryforwardRepository`の2つに依存するパターン。
 *
 * フェーズ5-1-3d-32で`carryForwardInvestmentLoss`も
 * `carryForwardInvestmentLossCore`として切り出した
 * (`futuresLossCarryforward.ts`の`carryForwardFuturesLossCore`と同じパターン。
 * `buildYearReport`は`defaultXxxRepository`経由で依存先を解決するため追加の
 * 依存注入は不要)。
 */
import { buildYearReport } from "@/lib/reporting";
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

export interface CarryForwardInvestmentLossInput {
  year: number;
}

export interface CarryForwardInvestmentLossResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

/**
 * 前年分の譲渡損益・繰越控除の計算結果から、翌年に繰り越す譲渡損失の残高を
 * 一括登録する。既に当年分に発生年ごとの登録がある場合は上書きしない。
 */
export async function carryForwardInvestmentLossCore(
  taxYearRepository: TaxYearRepository,
  investmentLossCarryforwardRepository: InvestmentLossCarryforwardRepository,
  input: CarryForwardInvestmentLossInput,
): Promise<CarryForwardInvestmentLossResult> {
  const { year } = input;
  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  const previousReport = await buildYearReport(year - 1);
  const candidates = previousReport?.lossCarryforward.carryforwardToNextYear ?? [];

  const existing = await investmentLossCarryforwardRepository.findByTaxYearId(
    taxYear.id,
  );
  const existingYears = new Set(existing.map((e) => e.originYear));

  const toCreate = candidates.filter((c) => !existingYears.has(c.originYear));

  await investmentLossCarryforwardRepository.createMany(
    toCreate.map((c) => ({
      taxYearId: taxYear.id,
      originYear: c.originYear,
      remainingAmountJpy: c.remainingAmountJpy.toString(),
    })),
  );

  return {
    redirectTo: `/import?year=${year}&tab=lossCarryforward&lossCarried=${toCreate.length}`,
  };
}
