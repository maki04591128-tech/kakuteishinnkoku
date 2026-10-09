"use server";

// 自宅サーバー版の既定実装(フェーズ7-3継続。7-2の`basicDeductionPageData.ts`と
// 同種のパターン)。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により`employmentIncomePageData.standalone.ts`に
// 差し替えられる。
//
// `/employment-income`ページはフェーズ7-1の決定に従い`"use client"`化し、
// `searchParams`の代わりに`useSearchParams()`で`year`を読み取る構成にした
// (`src/app/employment-income/page.tsx`・`EmploymentIncomePageContent.tsx`参照)。
// このファイルはそのClient Componentから`useEffect`(+`startTransition`)で
// 呼び出すServer Function(`"use server"`)として、既存の`listTaxYears`・
// `getEmploymentIncomeRecord`(いずれもリポジトリ抽象経由でPrisma/クライアントDB
// どちらにも対応済み)をそのまま呼ぶだけの薄いラッパー。
import { listTaxYears } from "@/lib/taxYear";
import { getEmploymentIncomeRecord } from "@/lib/employmentIncome";
import type { EmploymentIncomePageData } from "@/lib/employmentIncomePageData.types";

export async function getEmploymentIncomePageData(
  yearParam: number | null,
): Promise<EmploymentIncomePageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const record = await getEmploymentIncomeRecord(year);
  const registeredRecord = record
    ? {
        taxYear: record.taxYear,
        grossSalaryJpy: record.grossSalaryJpy.toNumber(),
        employmentIncomeJpy: record.employmentIncomeJpy.toNumber(),
      }
    : null;

  return { year, availableYears, registeredRecord };
}
