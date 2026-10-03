/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`setNisaLifetimeQuota`/`deleteNisaLifetimeQuota`から、
 * Next.js固有のAPI(`revalidatePath`/`redirect`)に依存しない部分
 * (入力検証・リポジトリ呼び出し・次の遷移先の決定)をコア関数として切り出した。
 * `TaxYearRepository`と`NisaLifetimeQuotaRepository`の2つに依存する点は
 * 3-5以降の繰越損失系アクションと同じパターンだが、本アクションは
 * NISA枠区分(`nisaType`)が`TSUMITATE`/`GROWTH`のいずれかであることの
 * 検証を伴う点が異なる(`actions.ts`に元からあった検証をそのまま移した)。
 * (同ファイルの`carryForwardNisaLifetimeQuota`は`buildYearReport`にも
 * 依存する別のアクションのため、本ステップの対象外)
 */
import type { InvestmentNisaType } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { NisaLifetimeQuotaRepository } from "@/lib/repositories/nisaLifetimeQuotaRepository";

export interface SetNisaLifetimeQuotaInput {
  year: number;
  nisaType: string;
  openingUsedJpy: string;
  soldCostBasisJpy: string;
}

export interface DeleteNisaLifetimeQuotaInput {
  id: number;
  year: number;
}

export interface NisaLifetimeQuotaActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function setNisaLifetimeQuotaCore(
  taxYearRepository: TaxYearRepository,
  nisaLifetimeQuotaRepository: NisaLifetimeQuotaRepository,
  input: SetNisaLifetimeQuotaInput,
): Promise<NisaLifetimeQuotaActionResult> {
  const { year, nisaType, openingUsedJpy, soldCostBasisJpy } = input;
  if (nisaType !== "TSUMITATE" && nisaType !== "GROWTH") {
    throw new Error("NISA枠区分が不正です");
  }

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await nisaLifetimeQuotaRepository.upsert({
    taxYearId: taxYear.id,
    nisaType: nisaType as InvestmentNisaType,
    openingUsedJpy,
    soldCostBasisJpy,
  });

  return { redirectTo: `/import?year=${year}&tab=nisaLifetime` };
}

export async function deleteNisaLifetimeQuotaCore(
  nisaLifetimeQuotaRepository: NisaLifetimeQuotaRepository,
  input: DeleteNisaLifetimeQuotaInput,
): Promise<NisaLifetimeQuotaActionResult> {
  const { id, year } = input;

  await nisaLifetimeQuotaRepository.delete(id);

  return { redirectTo: `/import?year=${year}&tab=nisaLifetime` };
}
