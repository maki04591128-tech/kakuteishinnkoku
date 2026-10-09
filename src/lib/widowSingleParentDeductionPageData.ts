"use server";

// 自宅サーバー版の既定実装(フェーズ7-3。7-2の`basicDeductionPageData.ts`と同種の
// パターン)。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)ではnext.config.ts
// のresolveAlias設定により`widowSingleParentDeductionPageData.standalone.ts`に
// 差し替えられる。
//
// `/widow-single-parent-deduction`ページはフェーズ7-1の決定に従い
// `"use client"`化し、`searchParams`の代わりに`useSearchParams()`で`year`を
// 読み取る構成にした(`src/app/widow-single-parent-deduction/page.tsx`・
// `WidowSingleParentDeductionPageContent.tsx`参照)。このファイルはそのClient
// Componentから`useEffect`(+`startTransition`)で呼び出すServer Function
// (`"use server"`)として、既存の`listTaxYears`・`getIncomeDeductionEntries`
// (いずれもリポジトリ抽象経由でPrisma/クライアントDBどちらにも対応済み)を
// そのまま呼ぶだけの薄いラッパー。
import { listTaxYears } from "@/lib/taxYear";
import { findIncomeDeductionEntry, getIncomeDeductionEntries } from "@/lib/incomeDeduction";
import type { WidowSingleParentDeductionPageData } from "@/lib/widowSingleParentDeductionPageData.types";

export async function getWidowSingleParentDeductionPageData(
  yearParam: number | null,
): Promise<WidowSingleParentDeductionPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const registeredCategoryEntry = findIncomeDeductionEntry(
    incomeDeductionEntries,
    "WIDOW_SINGLE_PARENT",
  );
  const registeredCategoryDeduction = registeredCategoryEntry
    ? {
        incomeTaxAmountJpy: Number(registeredCategoryEntry.incomeTaxAmountJpy),
        residentTaxAmountJpy: Number(registeredCategoryEntry.residentTaxAmountJpy),
      }
    : null;
  const registeredWorkingStudentEntry = findIncomeDeductionEntry(
    incomeDeductionEntries,
    "WORKING_STUDENT",
  );
  const registeredWorkingStudentDeduction = registeredWorkingStudentEntry
    ? {
        incomeTaxAmountJpy: Number(registeredWorkingStudentEntry.incomeTaxAmountJpy),
        residentTaxAmountJpy: Number(registeredWorkingStudentEntry.residentTaxAmountJpy),
      }
    : null;

  return {
    year,
    availableYears,
    registeredCategoryDeduction,
    registeredWorkingStudentDeduction,
  };
}
