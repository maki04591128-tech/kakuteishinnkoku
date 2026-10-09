"use server";

// 自宅サーバー版の既定実装(フェーズ7-3継続10回目。7-2の`basicDeductionPageData.ts`と
// 同種のパターン)。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により
// `certifiedHousingConstructionCreditPageData.standalone.ts`に差し替えられる。
//
// `/certified-housing-construction-credit`ページはフェーズ7-1の決定に従い
// `"use client"`化し、`searchParams`の代わりに`useSearchParams()`で`year`を
// 読み取る構成にした(`src/app/certified-housing-construction-credit/page.tsx`・
// `CertifiedHousingConstructionCreditPageContent.tsx`参照)。このファイルは
// そのClient Componentから`useEffect`(+`startTransition`)で呼び出すServer
// Function(`"use server"`)として、既存の`listTaxYears`・
// `getCertifiedHousingConstructionCreditRecord`・
// `getCertifiedHousingConstructionCreditCarryforward`(いずれもリポジトリ抽象経由で
// Prisma/クライアントDBどちらにも対応済み)をそのまま呼ぶだけの薄いラッパー。
// `saved`/`deleted`/`carryforwardSaved`/`carryforwardApplied`/`carryforwardDeleted`
// クエリ値はDBに依存しない純粋なURL表示フラグのため、このページデータには含めず
// 呼び出し側(`CertifiedHousingConstructionCreditPageContent.tsx`)で直接
// `useSearchParams()`から読み取る。
import {
  getCertifiedHousingConstructionCreditCarryforward,
  getCertifiedHousingConstructionCreditRecord,
} from "@/lib/certifiedHousingConstructionCredit";
import { listTaxYears } from "@/lib/taxYear";
import type { CertifiedHousingConstructionCreditPageData } from "@/lib/certifiedHousingConstructionCreditPageData.types";

export async function getCertifiedHousingConstructionCreditPageData(
  yearParam: number | null,
): Promise<CertifiedHousingConstructionCreditPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const [registeredRecord, incomingCarryforward] = await Promise.all([
    getCertifiedHousingConstructionCreditRecord(year),
    getCertifiedHousingConstructionCreditCarryforward(year),
  ]);

  return {
    year,
    availableYears,
    registeredCreditJpy: registeredRecord ? registeredRecord.creditJpy.toNumber() : null,
    incomingCarryforward: incomingCarryforward
      ? {
          originYear: incomingCarryforward.originYear,
          remainingAmountJpy: incomingCarryforward.remainingAmountJpy.toString(),
        }
      : null,
  };
}
