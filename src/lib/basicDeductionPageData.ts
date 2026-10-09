"use server";

// 自宅サーバー版の既定実装(フェーズ7-2のPoC)。スタンドアロン版ビルド
// (`BUILD_TARGET=standalone`)ではnext.config.tsのresolveAlias設定により
// `basicDeductionPageData.standalone.ts`に差し替えられる
// (`@/lib/incomeDeductionActions`等と同種のパターン)。
//
// `/basic-deduction`ページはフェーズ7-1の決定に従い`"use client"`化し、
// `searchParams`の代わりに`useSearchParams()`で`year`を読み取る構成にした
// (`src/app/basic-deduction/page.tsx`・`BasicDeductionPageContent.tsx`参照)。
// このファイルはそのClient Componentから`useEffect`(+`startTransition`)で
// 呼び出すServer Function(`"use server"`)として、既存の`listTaxYears`・
// `getIncomeDeductionEntries`(いずれもリポジトリ抽象経由でPrisma/クライアントDB
// どちらにも対応済み)をそのまま呼ぶだけの薄いラッパー。
import { listTaxYears } from "@/lib/taxYear";
import { findIncomeDeductionEntry, getIncomeDeductionEntries } from "@/lib/incomeDeduction";
import type { BasicDeductionPageData } from "@/lib/basicDeductionPageData.types";

export async function getBasicDeductionPageData(
  yearParam: number | null,
): Promise<BasicDeductionPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const registeredEntry = findIncomeDeductionEntry(incomeDeductionEntries, "BASIC");
  const registeredDeductionJpy = registeredEntry
    ? Number(registeredEntry.incomeTaxAmountJpy)
    : null;

  return { year, availableYears, registeredDeductionJpy };
}
