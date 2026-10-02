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
 */
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
