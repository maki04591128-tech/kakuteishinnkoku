"use server";

// 自宅サーバー版の既定実装(フェーズ7-3。7-2の`basicDeductionPageData.ts`と同種の
// パターン)。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)ではnext.config.ts
// のresolveAlias設定により`mortgageDeductionPageData.standalone.ts`に
// 差し替えられる。
//
// `/mortgage-deduction`ページはフェーズ7-1の決定に従い`"use client"`化し、
// `searchParams`の代わりに`useSearchParams()`で`year`を読み取る構成にした
// (`src/app/mortgage-deduction/page.tsx`・`MortgageDeductionPageContent.tsx`
// 参照)。このファイルはそのClient Componentから`useEffect`(+`startTransition`)で
// 呼び出すServer Function(`"use server"`)として、既存の`listTaxYears`・
// `getMortgageDeductionRecord`(いずれもリポジトリ抽象経由でPrisma/クライアントDB
// どちらにも対応済み)をそのまま呼ぶだけの薄いラッパー。
import { listTaxYears } from "@/lib/taxYear";
import { getMortgageDeductionRecord } from "@/lib/mortgageDeduction";
import type { MortgageDeductionPageData } from "@/lib/mortgageDeductionPageData.types";

export async function getMortgageDeductionPageData(
  yearParam: number | null,
): Promise<MortgageDeductionPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const mortgageDeductionRecord = await getMortgageDeductionRecord(year);
  const registeredRecord = mortgageDeductionRecord
    ? {
        taxYear: mortgageDeductionRecord.taxYear,
        nationalTaxCreditJpy: mortgageDeductionRecord.nationalTaxCreditJpy.toNumber(),
        residentTaxCreditJpy: mortgageDeductionRecord.residentTaxCreditJpy.toNumber(),
      }
    : null;

  return { year, availableYears, registeredRecord };
}
