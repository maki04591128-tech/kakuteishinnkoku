"use server";

// 自宅サーバー版の既定実装(フェーズ7-3。7-2の`basicDeductionPageData.ts`と同種の
// パターン)。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)ではnext.config.ts
// のresolveAlias設定により`socialInsuranceDeductionPageData.standalone.ts`に
// 差し替えられる。
//
// `/social-insurance-deduction`ページはフェーズ7-1の決定に従い`"use client"`化し、
// `searchParams`の代わりに`useSearchParams()`で`year`を読み取る構成にした
// (`src/app/social-insurance-deduction/page.tsx`・
// `SocialInsuranceDeductionPageContent.tsx`参照)。このファイルはそのClient
// Componentから`useEffect`(+`startTransition`)で呼び出すServer Function
// (`"use server"`)として、既存の`listTaxYears`・`getIncomeDeductionEntries`
// (いずれもリポジトリ抽象経由でPrisma/クライアントDBどちらにも対応済み)を
// そのまま呼ぶだけの薄いラッパー。
import { listTaxYears } from "@/lib/taxYear";
import { findIncomeDeductionEntry, getIncomeDeductionEntries } from "@/lib/incomeDeduction";
import type { SocialInsuranceDeductionPageData } from "@/lib/socialInsuranceDeductionPageData.types";

export async function getSocialInsuranceDeductionPageData(
  yearParam: number | null,
): Promise<SocialInsuranceDeductionPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const registeredEntry = findIncomeDeductionEntry(incomeDeductionEntries, "SOCIAL_INSURANCE");
  const registeredDeductionJpy = registeredEntry
    ? Number(registeredEntry.incomeTaxAmountJpy)
    : null;

  return { year, availableYears, registeredDeductionJpy };
}
