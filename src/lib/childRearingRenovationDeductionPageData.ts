"use server";

// 自宅サーバー版の既定実装(フェーズ7-3。7-2の`basicDeductionPageData.ts`と同種の
// パターン)。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)ではnext.config.ts
// のresolveAlias設定により`childRearingRenovationDeductionPageData.standalone.ts`に
// 差し替えられる。
//
// `/child-rearing-renovation-deduction`ページはフェーズ7-1の決定に従い
// `"use client"`化し、`searchParams`の代わりに`useSearchParams()`で`year`を
// 読み取る構成にした(`src/app/child-rearing-renovation-deduction/page.tsx`・
// `ChildRearingRenovationDeductionPageContent.tsx`参照)。このファイルはそのClient
// Componentから`useEffect`(+`startTransition`)で呼び出すServer Function
// (`"use server"`)として、既存の`listTaxYears`・
// `getChildRearingRenovationDeductionRecord`(いずれもリポジトリ抽象経由でPrisma/
// クライアントDBどちらにも対応済み)をそのまま呼ぶだけの薄いラッパー。
// `saved`/`deleted`クエリ値はDBに依存しない純粋なURL表示フラグのため、この
// ページデータには含めず呼び出し側
// (`ChildRearingRenovationDeductionPageContent.tsx`)で直接`useSearchParams()`から
// 読み取る。
import { listTaxYears } from "@/lib/taxYear";
import { getChildRearingRenovationDeductionRecord } from "@/lib/childRearingRenovationDeduction";
import type { ChildRearingRenovationDeductionPageData } from "@/lib/childRearingRenovationDeductionPageData.types";

export async function getChildRearingRenovationDeductionPageData(
  yearParam: number | null,
): Promise<ChildRearingRenovationDeductionPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const registeredRecord = await getChildRearingRenovationDeductionRecord(year);
  const registeredCreditJpy = registeredRecord ? registeredRecord.creditJpy.toNumber() : null;

  return { year, availableYears, registeredCreditJpy };
}
