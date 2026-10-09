"use server";

// 自宅サーバー版の既定実装(フェーズ7-3継続)。スタンドアロン版ビルド
// (`BUILD_TARGET=standalone`)ではnext.config.tsのresolveAlias設定により
// `cryptoIncomeClassificationPageData.standalone.ts`に差し替えられる。
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
