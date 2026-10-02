/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`setAngelTaxLossCarryforward`/
 * `deleteAngelTaxLossCarryforward`から、Next.js固有のAPI(`revalidatePath`/
 * `redirect`)に依存しない部分(入力検証・リポジトリ呼び出し・次の遷移先の決定)を
 * コア関数として切り出した。3-2〜3-4は依存リポジトリが1つだけの単純な
 * アクションだったが、本アクションは`getOrCreateTaxYear`(年のレコードを
 * 取得・作成)と`angelTaxLossCarryforwardRepository`(繰越損失の登録・削除)の
 * **2つ**のリポジトリに依存する最初の例であり、`TaxYearRepository`も
 * 引数でDIする形にしてパターンを拡張した。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { AngelTaxLossCarryforwardRepository } from "@/lib/repositories/angelTaxLossCarryforwardRepository";

export interface SetAngelTaxLossCarryforwardInput {
  year: number;
  originYear: number;
  remainingAmountJpy: string;
}

export interface DeleteAngelTaxLossCarryforwardInput {
  id: number;
  year: number;
}

export interface AngelTaxLossCarryforwardActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function setAngelTaxLossCarryforwardCore(
  taxYearRepository: TaxYearRepository,
  angelTaxLossCarryforwardRepository: AngelTaxLossCarryforwardRepository,
  input: SetAngelTaxLossCarryforwardInput,
): Promise<AngelTaxLossCarryforwardActionResult> {
  const { year, originYear, remainingAmountJpy } = input;
  if (!Number.isInteger(originYear) || originYear > year) {
    throw new Error("損失の発生年は対象年分以前の年である必要があります");
  }

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await angelTaxLossCarryforwardRepository.upsert({
    taxYearId: taxYear.id,
    originYear,
    remainingAmountJpy,
  });

  return { redirectTo: `/angel-tax-loss-carryforward?year=${year}` };
}

export async function deleteAngelTaxLossCarryforwardCore(
  angelTaxLossCarryforwardRepository: AngelTaxLossCarryforwardRepository,
  input: DeleteAngelTaxLossCarryforwardInput,
): Promise<AngelTaxLossCarryforwardActionResult> {
  const { id, year } = input;

  await angelTaxLossCarryforwardRepository.delete(id);

  return { redirectTo: `/angel-tax-loss-carryforward?year=${year}` };
}
