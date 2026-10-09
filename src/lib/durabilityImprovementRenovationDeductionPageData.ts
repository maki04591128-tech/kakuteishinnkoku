"use server";

// 自宅サーバー版の既定実装(フェーズ7-3。7-2の`basicDeductionPageData.ts`と同種の
// パターン)。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)ではnext.config.ts
// のresolveAlias設定により
// `durabilityImprovementRenovationDeductionPageData.standalone.ts`に差し替えられる。
//
// `/durability-improvement-renovation-deduction`ページはフェーズ7-1の決定に従い
// `"use client"`化し、`searchParams`の代わりに`useSearchParams()`で`year`を
// 読み取る構成にした(`src/app/durability-improvement-renovation-deduction/page.tsx`・
// `DurabilityImprovementRenovationDeductionPageContent.tsx`参照)。このファイルは
// そのClient Componentから`useEffect`(+`startTransition`)で呼び出すServer
// Function(`"use server"`)として、既存の`listTaxYears`・
// `getDurabilityImprovementRenovationDeductionRecord`(いずれもリポジトリ抽象経由で
// Prisma/クライアントDBどちらにも対応済み)をそのまま呼ぶだけの薄いラッパー。
// `saved`/`deleted`クエリ値はDBに依存しない純粋なURL表示フラグのため、この
// ページデータには含めず呼び出し側
// (`DurabilityImprovementRenovationDeductionPageContent.tsx`)で直接
// `useSearchParams()`から読み取る。
import { listTaxYears } from "@/lib/taxYear";
import { getDurabilityImprovementRenovationDeductionRecord } from "@/lib/durabilityImprovementRenovationDeduction";
import type { DurabilityImprovementRenovationDeductionPageData } from "@/lib/durabilityImprovementRenovationDeductionPageData.types";

export async function getDurabilityImprovementRenovationDeductionPageData(
  yearParam: number | null,
): Promise<DurabilityImprovementRenovationDeductionPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const registeredRecord = await getDurabilityImprovementRenovationDeductionRecord(year);
  const registeredCreditJpy = registeredRecord ? registeredRecord.creditJpy.toNumber() : null;

  return { year, availableYears, registeredCreditJpy };
}
