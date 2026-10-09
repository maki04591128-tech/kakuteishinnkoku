// スタンドアロン版ビルド用の`@/lib/cryptoIncomeClassificationPageData`差し替え
// 実装(next.config.tsのresolveAlias経由。フェーズ7-3継続)。
//
// 呼び出し元(`CryptoIncomeClassificationPageContent.tsx`、`"use client"`
// コンポーネント)から見た関数シグネチャを変えずに、同じ`buildYearReport`・
// `listTaxYears`を呼ぶ実装に差し替える。これらはビルドターゲット切り替え機構
// 経由で参照するため、このファイル自体はPrisma/クライアントDBどちらの実装かを
// 意識しない。
import { buildYearReport } from "@/lib/reporting";
import { listTaxYears } from "@/lib/taxYear";
import type { CryptoIncomeClassificationPageData } from "@/lib/cryptoIncomeClassificationPageData.types";

export async function getCryptoIncomeClassificationPageData(
  yearParam: number | null,
): Promise<CryptoIncomeClassificationPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const report = await buildYearReport(year);
  const defaultTotalRevenueJpy = report?.crypto.totalRevenueJpy.toNumber() ?? 0;

  return { year, availableYears, defaultTotalRevenueJpy };
}
