/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`setFuturesLossCarryforward`/
 * `deleteFuturesLossCarryforward`から、Next.js固有のAPI(`revalidatePath`/
 * `redirect`)に依存しない部分(入力検証・リポジトリ呼び出し・次の遷移先の決定)を
 * コア関数として切り出した。3-5の`setAngelTaxLossCarryforward`に続き
 * `getOrCreateTaxYear`(`TaxYearRepository`)と個別の繰越控除リポジトリ
 * (`FuturesLossCarryforwardRepository`)の2つに依存する構成の2例目。
 * (同ファイルの`carryForwardFuturesLoss`は`buildYearReport`にも依存する
 * 別のアクションのため、本ステップの対象外)
 *
 * フェーズ5-1-3d-32: 上記の`carryForwardFuturesLoss`も
 * `carryForwardFuturesLossCore`として切り出した。`buildYearReport`は
 * `src/lib/reporting.ts`が`defaultXxxRepository`経由で依存先リポジトリを
 * 解決するため(フェーズ1で移行済み)、本コア関数からは追加の依存注入をせず
 * そのまま呼び出せる(`carryForwardForeignTaxCreditExcessCore`等の
 * フォーム入力をそのまま保存する系と異なり、前年分の再計算結果を使う点が
 * 異なる)。
 */
import { buildYearReport } from "@/lib/reporting";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { FuturesLossCarryforwardRepository } from "@/lib/repositories/futuresLossCarryforwardRepository";

export interface SetFuturesLossCarryforwardInput {
  year: number;
  originYear: number;
  remainingAmountJpy: string;
}

export interface DeleteFuturesLossCarryforwardInput {
  id: number;
  year: number;
}

export interface FuturesLossCarryforwardActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function setFuturesLossCarryforwardCore(
  taxYearRepository: TaxYearRepository,
  futuresLossCarryforwardRepository: FuturesLossCarryforwardRepository,
  input: SetFuturesLossCarryforwardInput,
): Promise<FuturesLossCarryforwardActionResult> {
  const { year, originYear, remainingAmountJpy } = input;
  if (!Number.isInteger(originYear) || originYear > year) {
    throw new Error("損失の発生年は対象年分以前の年である必要があります");
  }

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await futuresLossCarryforwardRepository.upsert({
    taxYearId: taxYear.id,
    originYear,
    remainingAmountJpy,
  });

  return { redirectTo: `/import?year=${year}&tab=futuresLossCarryforward` };
}

export async function deleteFuturesLossCarryforwardCore(
  futuresLossCarryforwardRepository: FuturesLossCarryforwardRepository,
  input: DeleteFuturesLossCarryforwardInput,
): Promise<FuturesLossCarryforwardActionResult> {
  const { id, year } = input;

  await futuresLossCarryforwardRepository.delete(id);

  return { redirectTo: `/import?year=${year}&tab=futuresLossCarryforward` };
}

export interface CarryForwardFuturesLossInput {
  year: number;
}

export interface CarryForwardFuturesLossResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

/**
 * 前年分の先物取引に係る雑所得等・繰越控除の計算結果から、翌年に繰り越す損失の
 * 残高を一括登録する。既に当年分に発生年ごとの登録がある場合は上書きしない。
 */
export async function carryForwardFuturesLossCore(
  taxYearRepository: TaxYearRepository,
  futuresLossCarryforwardRepository: FuturesLossCarryforwardRepository,
  input: CarryForwardFuturesLossInput,
): Promise<CarryForwardFuturesLossResult> {
  const { year } = input;
  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  const previousReport = await buildYearReport(year - 1);
  const candidates =
    previousReport?.futuresLossCarryforward.carryforwardToNextYear ?? [];

  const existing = await futuresLossCarryforwardRepository.findByTaxYearId(taxYear.id);
  const existingYears = new Set(existing.map((e) => e.originYear));

  const toCreate = candidates.filter((c) => !existingYears.has(c.originYear));

  await futuresLossCarryforwardRepository.createMany(
    toCreate.map((c) => ({
      taxYearId: taxYear.id,
      originYear: c.originYear,
      remainingAmountJpy: c.remainingAmountJpy.toString(),
    })),
  );

  return {
    redirectTo: `/import?year=${year}&tab=futuresLossCarryforward&futuresLossCarried=${toCreate.length}`,
  };
}
