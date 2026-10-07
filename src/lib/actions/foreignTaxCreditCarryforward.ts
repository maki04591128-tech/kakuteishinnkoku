/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`setForeignTaxCreditCarryforward`/
 * `deleteForeignTaxCreditCarryforward`から、Next.js固有のAPI(`revalidatePath`/
 * `redirect`)に依存しない部分(入力検証・リポジトリ呼び出し・次の遷移先の決定)を
 * コア関数として切り出した。3-5〜3-9(`setAngelTaxLossCarryforward`・
 * `setFuturesLossCarryforward`・`setCasualtyLossCarryforward`・
 * `setHomeSaleLossCarryforward`・`setHomeReplacementLossCarryforward`)に続き、
 * `getOrCreateTaxYear`(`TaxYearRepository`)と個別の繰越控除リポジトリ
 * (`ForeignTaxCreditCarryforwardRepository`)の2つに依存する構成の6例目
 * (ロジックは3-5〜3-9と同一パターン)。
 */
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { ForeignTaxCreditCarryforwardRepository } from "@/lib/repositories/foreignTaxCreditCarryforwardRepository";

export interface SetForeignTaxCreditCarryforwardInput {
  year: number;
  originYear: number;
  remainingAmountJpy: string;
}

export interface DeleteForeignTaxCreditCarryforwardInput {
  id: number;
  year: number;
}

export interface ForeignTaxCreditCarryforwardActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function setForeignTaxCreditCarryforwardCore(
  taxYearRepository: TaxYearRepository,
  foreignTaxCreditCarryforwardRepository: ForeignTaxCreditCarryforwardRepository,
  input: SetForeignTaxCreditCarryforwardInput,
): Promise<ForeignTaxCreditCarryforwardActionResult> {
  const { year, originYear, remainingAmountJpy } = input;
  if (!Number.isInteger(originYear) || originYear > year) {
    throw new Error("控除限度超過額の発生年は対象年分以前の年である必要があります");
  }

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await foreignTaxCreditCarryforwardRepository.upsert({
    taxYearId: taxYear.id,
    originYear,
    remainingAmountJpy,
  });

  return { redirectTo: `/import?year=${year}&tab=foreignTaxCredit` };
}

export async function deleteForeignTaxCreditCarryforwardCore(
  foreignTaxCreditCarryforwardRepository: ForeignTaxCreditCarryforwardRepository,
  input: DeleteForeignTaxCreditCarryforwardInput,
): Promise<ForeignTaxCreditCarryforwardActionResult> {
  const { id, year } = input;

  await foreignTaxCreditCarryforwardRepository.delete(id);

  return { redirectTo: `/import?year=${year}&tab=foreignTaxCredit` };
}

export interface CarryForwardForeignTaxCreditExcessInput {
  year: number;
  entries: { originYear: number; remainingAmountJpy: string }[];
}

export interface CarryForwardForeignTaxCreditExcessResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

/**
 * フェーズ5-1-3d-16: `src/app/actions.ts`の`carryForwardForeignTaxCreditExcess`から
 * コア部分を切り出した(`setForeignTaxCreditCarryforwardCore`等と同じ理由)。
 * 外国税額控除シミュレーター(/foreign-tax-credit)の当年分の計算結果のうち、
 * 翌年以後に繰り越す控除限度超過額(発生年ごと)を、翌年分の
 * ForeignTaxCreditCarryforwardとしてまとめて登録する
 * (既に翌年分に同じ発生年の登録がある場合は上書きしない。
 * `carryForwardCasualtyLossExcessCore`と同じパターン)。
 */
export async function carryForwardForeignTaxCreditExcessCore(
  taxYearRepository: TaxYearRepository,
  foreignTaxCreditCarryforwardRepository: ForeignTaxCreditCarryforwardRepository,
  input: CarryForwardForeignTaxCreditExcessInput,
): Promise<CarryForwardForeignTaxCreditExcessResult> {
  const { year, entries } = input;

  const nextTaxYear = await taxYearRepository.getOrCreateTaxYear(year + 1);
  const existing = await foreignTaxCreditCarryforwardRepository.findByTaxYearId(nextTaxYear.id);
  const existingYears = new Set(existing.map((e) => e.originYear));
  const toCreate = entries.filter((e) => !existingYears.has(e.originYear));

  await foreignTaxCreditCarryforwardRepository.createMany(
    toCreate.map((e) => ({
      taxYearId: nextTaxYear.id,
      originYear: e.originYear,
      remainingAmountJpy: e.remainingAmountJpy,
    })),
  );

  return { redirectTo: `/foreign-tax-credit?year=${year}&excessCarried=${toCreate.length}` };
}
