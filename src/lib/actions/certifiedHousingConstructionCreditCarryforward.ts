/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`carryForwardCertifiedHousingConstructionCreditExcess`/
 * `applyCertifiedHousingConstructionCreditCarryforward`/
 * `deleteCertifiedHousingConstructionCreditCarryforward`から、Next.js固有のAPI
 * (`revalidatePath`/`redirect`)に依存しない部分(リポジトリ呼び出し・次の遷移先の
 * 決定)をコア関数として切り出した(`certifiedHousingConstructionCreditRecord.ts`の
 * save/delete版に続く、この控除の繰越(`CertifiedHousingConstructionCreditCarryforward`、
 * 1年限りの繰越)を扱う3関数)。
 */
import { Decimal } from "decimal.js";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { CertifiedHousingConstructionCreditRecordRepository } from "@/lib/repositories/certifiedHousingConstructionCreditRecordRepository";
import type { CertifiedHousingConstructionCreditCarryforwardRepository } from "@/lib/repositories/certifiedHousingConstructionCreditCarryforwardRepository";

export interface CarryForwardCertifiedHousingConstructionCreditExcessInput {
  year: number;
  remainingAmountJpy: string;
}

export interface ApplyCertifiedHousingConstructionCreditCarryforwardInput {
  year: number;
}

export interface DeleteCertifiedHousingConstructionCreditCarryforwardInput {
  year: number;
}

export interface CertifiedHousingConstructionCreditCarryforwardActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function carryForwardCertifiedHousingConstructionCreditExcessCore(
  taxYearRepository: TaxYearRepository,
  certifiedHousingConstructionCreditCarryforwardRepository: CertifiedHousingConstructionCreditCarryforwardRepository,
  input: CarryForwardCertifiedHousingConstructionCreditExcessInput,
): Promise<CertifiedHousingConstructionCreditCarryforwardActionResult> {
  const { year, remainingAmountJpy } = input;

  const nextTaxYear = await taxYearRepository.getOrCreateTaxYear(year + 1);
  await certifiedHousingConstructionCreditCarryforwardRepository.upsert({
    taxYearId: nextTaxYear.id,
    originYear: year,
    remainingAmountJpy,
  });

  return {
    redirectTo: `/certified-housing-construction-credit?year=${year}&carryforwardSaved=1`,
  };
}

export async function applyCertifiedHousingConstructionCreditCarryforwardCore(
  taxYearRepository: TaxYearRepository,
  certifiedHousingConstructionCreditRecordRepository: CertifiedHousingConstructionCreditRecordRepository,
  certifiedHousingConstructionCreditCarryforwardRepository: CertifiedHousingConstructionCreditCarryforwardRepository,
  input: ApplyCertifiedHousingConstructionCreditCarryforwardInput,
): Promise<CertifiedHousingConstructionCreditCarryforwardActionResult> {
  const { year } = input;

  const taxYear = await taxYearRepository.findByYear(year);
  const carryforward = taxYear
    ? await certifiedHousingConstructionCreditCarryforwardRepository.findByTaxYearId(taxYear.id)
    : null;

  if (taxYear && carryforward) {
    const existingRecord =
      await certifiedHousingConstructionCreditRecordRepository.findByTaxYearId(taxYear.id);
    const combinedCreditJpy = new Decimal(existingRecord?.creditJpy.toString() ?? "0")
      .plus(carryforward.remainingAmountJpy.toString())
      .toString();

    await certifiedHousingConstructionCreditRecordRepository.upsert({
      taxYearId: taxYear.id,
      creditJpy: combinedCreditJpy,
    });
    await certifiedHousingConstructionCreditCarryforwardRepository.deleteByTaxYearId(taxYear.id);
  }

  return {
    redirectTo: `/certified-housing-construction-credit?year=${year}&carryforwardApplied=1`,
  };
}

export async function deleteCertifiedHousingConstructionCreditCarryforwardCore(
  taxYearRepository: TaxYearRepository,
  certifiedHousingConstructionCreditCarryforwardRepository: CertifiedHousingConstructionCreditCarryforwardRepository,
  input: DeleteCertifiedHousingConstructionCreditCarryforwardInput,
): Promise<CertifiedHousingConstructionCreditCarryforwardActionResult> {
  const { year } = input;

  const taxYear = await taxYearRepository.findByYear(year);
  if (taxYear) {
    await certifiedHousingConstructionCreditCarryforwardRepository.deleteByTaxYearId(taxYear.id);
  }

  return {
    redirectTo: `/certified-housing-construction-credit?year=${year}&carryforwardDeleted=1`,
  };
}
