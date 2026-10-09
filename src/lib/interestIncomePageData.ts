"use server";

// 自宅サーバー版の既定実装(フェーズ7-3継続)。スタンドアロン版ビルド
// (`BUILD_TARGET=standalone`)ではnext.config.tsのresolveAlias設定により
// `interestIncomePageData.standalone.ts`に差し替えられる。
import { buildYearReport } from "@/lib/reporting";
import { listTaxYears } from "@/lib/taxYear";
import type { InterestIncomePageData } from "@/lib/interestIncomePageData.types";

export async function getInterestIncomePageData(
  yearParam: number | null,
): Promise<InterestIncomePageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const report = await buildYearReport(year);
  const defaultAvailableListedStockLossJpy = report
    ? Math.max(0, -report.investment.totalRealizedGainJpy.toNumber())
    : 0;

  return { year, availableYears, defaultAvailableListedStockLossJpy };
}
