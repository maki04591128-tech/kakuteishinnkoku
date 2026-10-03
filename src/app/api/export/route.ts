import { NextRequest, NextResponse } from "next/server";
import { buildDraftCsvExport } from "@/lib/etax/exportDraftCsv";

export async function GET(request: NextRequest) {
  const yearParam = request.nextUrl.searchParams.get("year");
  const year = Number(yearParam) || new Date().getFullYear();

  const result = await buildDraftCsvExport(year);
  if (!result) {
    return NextResponse.json({ error: "指定された年分のデータがありません" }, { status: 404 });
  }

  return new NextResponse(result.content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
