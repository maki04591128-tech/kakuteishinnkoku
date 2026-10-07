/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`setOpeningBalance`/`deleteOpeningBalance`から、
 * Next.js固有のAPI(`revalidatePath`/`redirect`)に依存しない部分
 * (入力検証・リポジトリ呼び出し・次の遷移先の決定)をコア関数として切り出した。
 * `TaxYearRepository`と`OpeningBalanceRepository`の2つに依存する点は
 * 3-5以降の繰越損失系アクションと同じパターンだが、本アクションは
 * NISA口座・一般株式等(非上場株式)区分の整合性検証(`isNisa && !isListed`は
 * エラー)を伴う点が異なる(`actions.ts`に元からあった検証をそのまま移した)。
 *
 * フェーズ5-1-3d-32で`carryForwardOpeningBalances`も
 * `carryForwardOpeningBalancesCore`として切り出した
 * (`futuresLossCarryforward.ts`の`carryForwardFuturesLossCore`と同じパターン。
 * `buildCarryForwardCandidates`(`@/lib/reporting`)は内部で`buildYearReport`を
 * 呼ぶため、`defaultXxxRepository`経由で依存先を解決し追加の依存注入は不要)。
 */
import { buildCarryForwardCandidates } from "@/lib/reporting";
import type { OpeningBalanceAssetClass } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { OpeningBalanceRepository } from "@/lib/repositories/openingBalanceRepository";

export interface SetOpeningBalanceInput {
  year: number;
  assetClass: OpeningBalanceAssetClass;
  symbol: string;
  isNisa: boolean;
  isListed: boolean;
  quantity: string;
  costBasisJpy: string;
}

export interface DeleteOpeningBalanceInput {
  id: number;
  year: number;
}

export interface OpeningBalanceActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function setOpeningBalanceCore(
  taxYearRepository: TaxYearRepository,
  openingBalanceRepository: OpeningBalanceRepository,
  input: SetOpeningBalanceInput,
): Promise<OpeningBalanceActionResult> {
  const { year, assetClass, symbol, isNisa, isListed, quantity, costBasisJpy } =
    input;
  if (isNisa && !isListed) {
    throw new Error("一般株式等(非上場株式)はNISA口座の対象外です");
  }

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await openingBalanceRepository.upsert({
    taxYearId: taxYear.id,
    assetClass,
    symbol,
    isNisa,
    isListed,
    quantity,
    costBasisJpy,
  });

  return { redirectTo: `/import?year=${year}&tab=opening` };
}

export async function deleteOpeningBalanceCore(
  openingBalanceRepository: OpeningBalanceRepository,
  input: DeleteOpeningBalanceInput,
): Promise<OpeningBalanceActionResult> {
  const { id, year } = input;

  await openingBalanceRepository.delete(id);

  return { redirectTo: `/import?year=${year}&tab=opening` };
}

export interface CarryForwardOpeningBalancesInput {
  year: number;
}

export interface CarryForwardOpeningBalancesResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

/**
 * 前年の期末残高(取引と期首残高から再計算した結果)を、当年の期首残高として
 * 一括登録する。既に当年の期首残高が登録されている銘柄は上書きしない。
 */
export async function carryForwardOpeningBalancesCore(
  taxYearRepository: TaxYearRepository,
  openingBalanceRepository: OpeningBalanceRepository,
  input: CarryForwardOpeningBalancesInput,
): Promise<CarryForwardOpeningBalancesResult> {
  const { year } = input;
  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  const candidates = await buildCarryForwardCandidates(year - 1);

  const existing = await openingBalanceRepository.findByTaxYearId(taxYear.id);
  const existingKeys = new Set(
    existing.map((e) => `${e.assetClass}:${e.symbol}:${e.isNisa}:${e.isListed}`),
  );

  const toCreate = candidates.filter(
    (c) => !existingKeys.has(`${c.assetClass}:${c.symbol}:${c.isNisa}:${c.isListed}`),
  );

  await openingBalanceRepository.createMany(
    toCreate.map((c) => ({
      taxYearId: taxYear.id,
      assetClass: c.assetClass,
      symbol: c.symbol,
      isNisa: c.isNisa,
      isListed: c.isListed,
      quantity: c.quantity,
      costBasisJpy: c.costBasisJpy,
    })),
  );

  return {
    redirectTo: `/import?year=${year}&tab=opening&carried=${toCreate.length}`,
  };
}
