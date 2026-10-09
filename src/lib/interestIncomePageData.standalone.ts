// スタンドアロン版ビルド用の`@/lib/interestIncomePageData`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ7-3継続)。
//
// 呼び出し元(`InterestIncomePageContent.tsx`、`"use client"`コンポーネント)
// から見た関数シグネチャを変えずに、同じ`buildYearReport`・`listTaxYears`を
// 呼ぶ実装に差し替える。これらはビルドターゲット切り替え機構経由で参照するため、
// このファイル自体はPrisma/クライアントDBどちらの実装かを意識しない。
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
