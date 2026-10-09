"use server";

// 自宅サーバー版の既定実装(フェーズ7-3。7-2の`basicDeductionPageData.ts`と同種の
// パターン)。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)ではnext.config.ts
// のresolveAlias設定により`donationTaxCreditPageData.standalone.ts`に
// 差し替えられる。
//
// `/donation-tax-credit`ページはフェーズ7-1の決定に従い`"use client"`化し、
// `searchParams`の代わりに`useSearchParams()`で`year`を読み取る構成にした
// (`src/app/donation-tax-credit/page.tsx`・`DonationTaxCreditPageContent.tsx`
// 参照)。このファイルはそのClient Componentから`useEffect`(+`startTransition`)で
// 呼び出すServer Function(`"use server"`)として、既存の`listTaxYears`・
// `getDonationTaxCreditRecord`(いずれもリポジトリ抽象経由でPrisma/クライアントDB
// どちらにも対応済み)をそのまま呼ぶだけの薄いラッパー。
import { listTaxYears } from "@/lib/taxYear";
import { getDonationTaxCreditRecord } from "@/lib/donationTaxCredit";
import type { DonationTaxCreditPageData } from "@/lib/donationTaxCreditPageData.types";

export async function getDonationTaxCreditPageData(
  yearParam: number | null,
): Promise<DonationTaxCreditPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const donationTaxCreditRecord = await getDonationTaxCreditRecord(year);
  const registeredRecord = donationTaxCreditRecord
    ? {
        taxYear: donationTaxCreditRecord.taxYear,
        totalTaxCreditJpy: donationTaxCreditRecord.totalTaxCreditJpy.toNumber(),
        residentTaxBasicDeductionJpy:
          donationTaxCreditRecord.residentTaxBasicDeductionJpy.toNumber(),
      }
    : null;

  return { year, availableYears, registeredRecord };
}
