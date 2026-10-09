"use server";

// 自宅サーバー版の既定実装(フェーズ7-3継続)。スタンドアロン版ビルド
// (`BUILD_TARGET=standalone`)ではnext.config.tsのresolveAlias設定により
// `dividendSimulationPageData.standalone.ts`に差し替えられる。
import { buildYearReport } from "@/lib/reporting";
import { listTaxYears } from "@/lib/taxYear";
import type { DividendSimulationPageData } from "@/lib/dividendSimulationPageData.types";

export async function getDividendSimulationPageData(
  yearParam: number | null,
): Promise<DividendSimulationPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const report = await buildYearReport(year);
  const defaultDividendJpy = report?.investment.totalDividendJpy.toNumber() ?? 0;
  const defaultDividendHalfCreditJpy =
    report?.investment.totalDividendHalfCreditJpy.toNumber() ?? 0;
  const defaultDividendQuarterCreditJpy =
    report?.investment.totalDividendQuarterCreditJpy.toNumber() ?? 0;
  const defaultDividendNoCreditJpy = report?.investment.totalDividendNoCreditJpy.toNumber() ?? 0;
  const defaultAvailableListedStockLossJpy = report
    ? Math.max(0, -report.investment.totalRealizedGainJpy.toNumber())
    : 0;
  const defaultNonListedDividendJpy = report?.investmentNonListed.totalDividendJpy.toNumber() ?? 0;
  const defaultNonListedDividendHalfCreditJpy =
    report?.investmentNonListed.totalDividendHalfCreditJpy.toNumber() ?? 0;
  const defaultNonListedDividendQuarterCreditJpy =
    report?.investmentNonListed.totalDividendQuarterCreditJpy.toNumber() ?? 0;
  const defaultNonListedDividendNoCreditJpy =
    report?.investmentNonListed.totalDividendNoCreditJpy.toNumber() ?? 0;

  return {
    year,
    availableYears,
    defaultDividendJpy,
    defaultDividendHalfCreditJpy,
    defaultDividendQuarterCreditJpy,
    defaultDividendNoCreditJpy,
    defaultAvailableListedStockLossJpy,
    defaultNonListedDividendJpy,
    defaultNonListedDividendHalfCreditJpy,
    defaultNonListedDividendQuarterCreditJpy,
    defaultNonListedDividendNoCreditJpy,
  };
}
