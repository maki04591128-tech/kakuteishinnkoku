import { NextRequest, NextResponse } from "next/server";
import { buildTaxFilingDraftCsv, UTF8_BOM } from "@/lib/etax/csvExport";
import { buildTaxFilingSummary } from "@/lib/etax/summary";
import { getIncomeDeductionEntries, summarizeIncomeDeductions } from "@/lib/incomeDeduction";
import { getDonationTaxCreditRecord } from "@/lib/donationTaxCredit";
import { getForeignTaxCreditRecord } from "@/lib/investment/foreignTaxCredit";
import { getDistributionAdjustedForeignTaxCreditRecord } from "@/lib/investment/distributionAdjustedForeignTaxCredit";
import { getMortgageDeductionRecord } from "@/lib/mortgageDeduction";
import { getResidentTaxAdjustmentDeductionRecord } from "@/lib/residentTaxAdjustmentDeduction";
import { getEarthquakeRenovationDeductionRecord } from "@/lib/earthquakeRenovationDeduction";
import { getEnergySavingRenovationDeductionRecord } from "@/lib/energySavingRenovationDeduction";
import { getBarrierFreeRenovationDeductionRecord } from "@/lib/barrierFreeRenovationDeduction";
import { getMultiHouseholdRenovationDeductionRecord } from "@/lib/multiHouseholdRenovationDeduction";
import { getDurabilityImprovementRenovationDeductionRecord } from "@/lib/durabilityImprovementRenovationDeduction";
import { getChildRearingRenovationDeductionRecord } from "@/lib/childRearingRenovationDeduction";
import { getCertifiedHousingConstructionCreditRecord } from "@/lib/certifiedHousingConstructionCredit";
import { buildYearReport } from "@/lib/reporting";

export async function GET(request: NextRequest) {
  const yearParam = request.nextUrl.searchParams.get("year");
  const year = Number(yearParam) || new Date().getFullYear();

  const report = await buildYearReport(year);
  if (!report) {
    return NextResponse.json({ error: "指定された年分のデータがありません" }, { status: 404 });
  }

  const [
    mortgageDeductionRecord,
    foreignTaxCreditRecord,
    donationTaxCreditRecord,
    distributionAdjustedForeignTaxCreditRecord,
    residentTaxAdjustmentDeductionRecord,
    earthquakeRenovationDeductionRecord,
    energySavingRenovationDeductionRecord,
    barrierFreeRenovationDeductionRecord,
    multiHouseholdRenovationDeductionRecord,
    durabilityImprovementRenovationDeductionRecord,
    childRearingRenovationDeductionRecord,
    certifiedHousingConstructionCreditRecord,
  ] = await Promise.all([
    getMortgageDeductionRecord(year),
    getForeignTaxCreditRecord(year),
    getDonationTaxCreditRecord(year),
    getDistributionAdjustedForeignTaxCreditRecord(year),
    getResidentTaxAdjustmentDeductionRecord(year),
    getEarthquakeRenovationDeductionRecord(year),
    getEnergySavingRenovationDeductionRecord(year),
    getBarrierFreeRenovationDeductionRecord(year),
    getMultiHouseholdRenovationDeductionRecord(year),
    getDurabilityImprovementRenovationDeductionRecord(year),
    getChildRearingRenovationDeductionRecord(year),
    getCertifiedHousingConstructionCreditRecord(year),
  ]);

  const summary = buildTaxFilingSummary(
    year,
    report.crypto,
    report.investment,
    report.lossCarryforward,
    report.cryptoMargin,
    report.futures,
    report.futuresLossCarryforward,
    mortgageDeductionRecord
      ? {
          nationalTaxCreditJpy: mortgageDeductionRecord.nationalTaxCreditJpy,
          residentTaxCreditJpy: mortgageDeductionRecord.residentTaxCreditJpy,
        }
      : undefined,
    foreignTaxCreditRecord
      ? { totalCreditJpy: foreignTaxCreditRecord.totalCreditJpy }
      : undefined,
    report.investmentNonListed,
    donationTaxCreditRecord
      ? {
          totalCreditJpy: donationTaxCreditRecord.totalTaxCreditJpy,
          residentTaxBasicDeductionJpy: donationTaxCreditRecord.residentTaxBasicDeductionJpy,
        }
      : undefined,
    distributionAdjustedForeignTaxCreditRecord
      ? { creditJpy: distributionAdjustedForeignTaxCreditRecord.creditJpy }
      : undefined,
    residentTaxAdjustmentDeductionRecord
      ? { adjustmentDeductionJpy: residentTaxAdjustmentDeductionRecord.adjustmentDeductionJpy }
      : undefined,
    earthquakeRenovationDeductionRecord
      ? { creditJpy: earthquakeRenovationDeductionRecord.creditJpy }
      : undefined,
    energySavingRenovationDeductionRecord
      ? { creditJpy: energySavingRenovationDeductionRecord.creditJpy }
      : undefined,
    barrierFreeRenovationDeductionRecord
      ? { creditJpy: barrierFreeRenovationDeductionRecord.creditJpy }
      : undefined,
    multiHouseholdRenovationDeductionRecord
      ? { creditJpy: multiHouseholdRenovationDeductionRecord.creditJpy }
      : undefined,
    durabilityImprovementRenovationDeductionRecord
      ? { creditJpy: durabilityImprovementRenovationDeductionRecord.creditJpy }
      : undefined,
    childRearingRenovationDeductionRecord
      ? { creditJpy: childRearingRenovationDeductionRecord.creditJpy }
      : undefined,
    certifiedHousingConstructionCreditRecord
      ? { creditJpy: certifiedHousingConstructionCreditRecord.creditJpy }
      : undefined,
    report.stockMargin,
  );
  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const incomeDeductions = summarizeIncomeDeductions(incomeDeductionEntries);

  const csv = buildTaxFilingDraftCsv(
    summary,
    report.crypto.bySymbol,
    report.investment.bySymbol,
    report.cryptoCostMethod,
    report.cryptoMargin.bySymbol,
    report.futures.bySymbol,
    incomeDeductions,
    report.investmentNonListed.bySymbol,
    report.stockMargin.bySymbol,
  );

  return new NextResponse(UTF8_BOM + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kakuteishinkoku_draft_${year}.csv"`,
    },
  });
}
