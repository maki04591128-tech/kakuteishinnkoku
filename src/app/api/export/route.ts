import { NextRequest, NextResponse } from "next/server";
import { buildTaxFilingDraftCsv, UTF8_BOM } from "@/lib/etax/csvExport";
import { buildTaxFilingSummary } from "@/lib/etax/summary";
import { getIncomeDeductionEntries, summarizeIncomeDeductions } from "@/lib/incomeDeduction";
import { getForeignTaxCreditRecord } from "@/lib/investment/foreignTaxCredit";
import { getMortgageDeductionRecord } from "@/lib/mortgageDeduction";
import { buildYearReport } from "@/lib/reporting";

export async function GET(request: NextRequest) {
  const yearParam = request.nextUrl.searchParams.get("year");
  const year = Number(yearParam) || new Date().getFullYear();

  const report = await buildYearReport(year);
  if (!report) {
    return NextResponse.json({ error: "指定された年分のデータがありません" }, { status: 404 });
  }

  const [mortgageDeductionRecord, foreignTaxCreditRecord] = await Promise.all([
    getMortgageDeductionRecord(year),
    getForeignTaxCreditRecord(year),
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
  );

  return new NextResponse(UTF8_BOM + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kakuteishinkoku_draft_${year}.csv"`,
    },
  });
}
