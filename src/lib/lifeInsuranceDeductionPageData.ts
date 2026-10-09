"use server";

// 自宅サーバー版の既定実装(フェーズ7-3。7-2の`basicDeductionPageData.ts`と同種の
// パターン)。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)ではnext.config.ts
// のresolveAlias設定により`lifeInsuranceDeductionPageData.standalone.ts`に
// 差し替えられる。
//
// `/life-insurance-deduction`ページはフェーズ7-1の決定に従い`"use client"`化し、
// `searchParams`の代わりに`useSearchParams()`で`year`を読み取る構成にした
// (`src/app/life-insurance-deduction/page.tsx`・`LifeInsuranceDeductionPageContent.tsx`
// 参照)。このファイルはそのClient Componentから`useEffect`(+`startTransition`)で
// 呼び出すServer Function(`"use server"`)として、既存の`listTaxYears`・
// `getIncomeDeductionEntries`(いずれもリポジトリ抽象経由でPrisma/クライアントDB
// どちらにも対応済み)をそのまま呼ぶだけの薄いラッパー。
import { listTaxYears } from "@/lib/taxYear";
import { findIncomeDeductionEntry, getIncomeDeductionEntries } from "@/lib/incomeDeduction";
import type { LifeInsuranceDeductionPageData } from "@/lib/lifeInsuranceDeductionPageData.types";

export async function getLifeInsuranceDeductionPageData(
  yearParam: number | null,
): Promise<LifeInsuranceDeductionPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const registeredEntry = findIncomeDeductionEntry(incomeDeductionEntries, "LIFE_INSURANCE");
  const registeredDeduction = registeredEntry
    ? {
        incomeTaxAmountJpy: Number(registeredEntry.incomeTaxAmountJpy),
        residentTaxAmountJpy: Number(registeredEntry.residentTaxAmountJpy),
      }
    : null;

  return { year, availableYears, registeredDeduction };
}
