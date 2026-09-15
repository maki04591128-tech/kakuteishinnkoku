import { NextRequest, NextResponse } from "next/server";
import { buildTaxFilingDraftCsv, UTF8_BOM } from "@/lib/etax/csvExport";
import { buildTaxFilingSummary } from "@/lib/etax/summary";
import { buildYearReport } from "@/lib/reporting";

export async function GET(request: NextRequest) {
  const yearParam = request.nextUrl.searchParams.get("year");
  const year = Number(yearParam) || new Date().getFullYear();

  const report = await buildYearReport(year);
  if (!report) {
    return NextResponse.json({ error: "指定された年分のデータがありません" }, { status: 404 });
  }

  const summary = buildTaxFilingSummary(year, report.crypto, report.investment);
  const csv = buildTaxFilingDraftCsv(
    summary,
    report.crypto.bySymbol,
    report.investment.bySymbol,
    report.cryptoCostMethod,
  );

  return new NextResponse(UTF8_BOM + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kakuteishinkoku_draft_${year}.csv"`,
    },
  });
}
