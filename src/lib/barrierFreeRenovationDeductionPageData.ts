"use server";

// 自宅サーバー版の既定実装(フェーズ7-3。7-2の`basicDeductionPageData.ts`と同種の
// パターン)。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)ではnext.config.ts
// のresolveAlias設定により`barrierFreeRenovationDeductionPageData.standalone.ts`に
// 差し替えられる。
//
// `/barrier-free-renovation-deduction`ページはフェーズ7-1の決定に従い
// `"use client"`化し、`searchParams`の代わりに`useSearchParams()`で`year`を
// 読み取る構成にした(`src/app/barrier-free-renovation-deduction/page.tsx`・
// `BarrierFreeRenovationDeductionPageContent.tsx`参照)。このファイルはそのClient
// Componentから`useEffect`(+`startTransition`)で呼び出すServer Function
// (`"use server"`)として、既存の`listTaxYears`・
// `getBarrierFreeRenovationDeductionRecord`(いずれもリポジトリ抽象経由でPrisma/
// クライアントDBどちらにも対応済み)をそのまま呼ぶだけの薄いラッパー。
// `saved`/`deleted`クエリ値はDBに依存しない純粋なURL表示フラグのため、この
// ページデータには含めず呼び出し側(`BarrierFreeRenovationDeductionPageContent.tsx`)で
// 直接`useSearchParams()`から読み取る。
import { listTaxYears } from "@/lib/taxYear";
import { getBarrierFreeRenovationDeductionRecord } from "@/lib/barrierFreeRenovationDeduction";
import type { BarrierFreeRenovationDeductionPageData } from "@/lib/barrierFreeRenovationDeductionPageData.types";

export async function getBarrierFreeRenovationDeductionPageData(
  yearParam: number | null,
): Promise<BarrierFreeRenovationDeductionPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const registeredRecord = await getBarrierFreeRenovationDeductionRecord(year);
  const registeredCreditJpy = registeredRecord ? registeredRecord.creditJpy.toNumber() : null;

  return { year, availableYears, registeredCreditJpy };
}
