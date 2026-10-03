/**
 * フェーズ3(Server Actions/Server Componentsの置き換え)。
 *
 * `src/app/actions.ts`の`setBrokerAnnualReport`/`deleteBrokerAnnualReport`から、
 * Next.js固有のAPI(`revalidatePath`/`redirect`)に依存しない部分(入力の
 * 前処理・リポジトリ呼び出し・次の遷移先の決定)をコア関数として切り出した。
 * `TaxYearRepository`と`BrokerAnnualReportRepository`の2つに依存する点は
 * 3-31の`setOpeningBalance`・3-32の`setOpeningBalanceByInstitution`と
 * 同じパターン(本アクションにも追加の整合性検証は無い)。
 */
import type { InvestmentAccountType } from "@prisma/client";
import type { TaxYearRepository } from "@/lib/repositories/taxYearRepository";
import type { BrokerAnnualReportRepository } from "@/lib/repositories/brokerAnnualReportRepository";

export interface SetBrokerAnnualReportInput {
  year: number;
  broker: string;
  accountType: InvestmentAccountType;
  proceedsJpy: string;
  acquisitionCostJpy: string;
  dividendJpy: string;
}

export interface DeleteBrokerAnnualReportInput {
  id: number;
  year: number;
}

export interface BrokerAnnualReportActionResult {
  /** 処理後に遷移すべきパス。 */
  redirectTo: string;
}

export async function setBrokerAnnualReportCore(
  taxYearRepository: TaxYearRepository,
  brokerAnnualReportRepository: BrokerAnnualReportRepository,
  input: SetBrokerAnnualReportInput,
): Promise<BrokerAnnualReportActionResult> {
  const { year, broker, accountType, proceedsJpy, acquisitionCostJpy, dividendJpy } = input;

  const taxYear = await taxYearRepository.getOrCreateTaxYear(year);
  await brokerAnnualReportRepository.upsert({
    taxYearId: taxYear.id,
    broker,
    accountType,
    proceedsJpy,
    acquisitionCostJpy,
    dividendJpy,
  });

  return { redirectTo: `/import?year=${year}&tab=brokerReport` };
}

export async function deleteBrokerAnnualReportCore(
  brokerAnnualReportRepository: BrokerAnnualReportRepository,
  input: DeleteBrokerAnnualReportInput,
): Promise<BrokerAnnualReportActionResult> {
  const { id, year } = input;

  await brokerAnnualReportRepository.delete(id);

  return { redirectTo: `/import?year=${year}&tab=brokerReport` };
}
