"use server";

// 自宅サーバー版の既定実装(フェーズ7-3継続。7-2の`basicDeductionPageData.ts`と
// 同種のパターン)。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `distributionAdjustedForeignTaxCreditPageData.standalone.ts`に差し替えられる。
//
// `/distribution-adjusted-foreign-tax-credit`ページはフェーズ7-1の決定に従い
// `"use client"`化し、`searchParams`の代わりに`useSearchParams()`で`year`を
// 読み取る構成にした(`src/app/distribution-adjusted-foreign-tax-credit/page.tsx`・
// `DistributionAdjustedForeignTaxCreditPageContent.tsx`参照)。このファイルは
// そのClient Componentから`useEffect`(+`startTransition`)で呼び出すServer
// Function(`"use server"`)として、既存の`listTaxYears`・`buildYearReport`・
// `getDistributionAdjustedForeignTaxCreditRecord`(いずれもリポジトリ抽象経由で
// Prisma/クライアントDBどちらにも対応済み)をそのまま呼ぶだけの薄いラッパー。
import { getDistributionAdjustedForeignTaxCreditRecord } from "@/lib/investment/distributionAdjustedForeignTaxCredit";
import { buildYearReport } from "@/lib/reporting";
import { listTaxYears } from "@/lib/taxYear";
import type { DistributionAdjustedForeignTaxCreditPageData } from "@/lib/distributionAdjustedForeignTaxCreditPageData.types";

export async function getDistributionAdjustedForeignTaxCreditPageData(
  yearParam: number | null,
): Promise<DistributionAdjustedForeignTaxCreditPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const [report, registeredRecord] = await Promise.all([
    buildYearReport(year),
    getDistributionAdjustedForeignTaxCreditRecord(year),
  ]);

  const autoDistributionAdjustedForeignTaxJpy =
    report?.investment.totalDistributionAdjustedForeignTaxJpy.toString() ?? "0";

  return {
    year,
    availableYears,
    autoDistributionAdjustedForeignTaxJpy,
    registeredCreditJpy: registeredRecord ? registeredRecord.creditJpy.toNumber() : null,
  };
}
