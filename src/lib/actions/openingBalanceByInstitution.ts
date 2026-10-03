/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`setOpeningBalanceByInstitution`/
 * `deleteOpeningBalanceByInstitution`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(入力の前処理・
 * リポジトリ呼び出し・次の遷移先の決定)をコア関数として切り出した。
 * `TaxYearRepository`と`OpeningBalanceByInstitutionRepository`の2つに
 * 依存する点は3-31の`setOpeningBalance`と同じパターン(NISA/非上場の
 * 整合性検証は、本アクションの対象である金融機関別内訳には存在しないため
 * 省いている)。
 */
import type { OpeningBalanceAssetClass } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { OpeningBalanceByInstitutionRepository } from "@/lib/repositories/openingBalanceByInstitutionRepository";

export interface SetOpeningBalanceByInstitutionInput {
  year: number;
  assetClass: OpeningBalanceAssetClass;
  symbol: string;
  institution: string;
  quantity: string;
}

export interface DeleteOpeningBalanceByInstitutionInput {
  id: number;
  year: number;
}

export interface OpeningBalanceByInstitutionActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function setOpeningBalanceByInstitutionCore(
  taxYearRepository: TaxYearRepository,
  openingBalanceByInstitutionRepository: OpeningBalanceByInstitutionRepository,
  input: SetOpeningBalanceByInstitutionInput,
): Promise<OpeningBalanceByInstitutionActionResult> {
  const { year, assetClass, symbol, institution, quantity } = input;

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await openingBalanceByInstitutionRepository.upsert({
    taxYearId: taxYear.id,
    assetClass,
    symbol,
    institution,
    quantity,
  });

  return { redirectTo: `/import?year=${year}&tab=assetBalance` };
}

export async function deleteOpeningBalanceByInstitutionCore(
  openingBalanceByInstitutionRepository: OpeningBalanceByInstitutionRepository,
  input: DeleteOpeningBalanceByInstitutionInput,
): Promise<OpeningBalanceByInstitutionActionResult> {
  const { id, year } = input;

  await openingBalanceByInstitutionRepository.delete(id);

  return { redirectTo: `/import?year=${year}&tab=assetBalance` };
}
