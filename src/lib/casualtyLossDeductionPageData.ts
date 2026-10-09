"use server";

// 自宅サーバー版の既定実装(フェーズ7-3。7-2の`basicDeductionPageData.ts`と同種の
// パターン)。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)ではnext.config.ts
// のresolveAlias設定により`casualtyLossDeductionPageData.standalone.ts`に
// 差し替えられる。
//
// `/casualty-loss-deduction`ページはフェーズ7-1の決定に従い`"use client"`化し、
// `searchParams`の代わりに`useSearchParams()`で`year`を読み取る構成にした
// (`src/app/casualty-loss-deduction/page.tsx`・
// `CasualtyLossDeductionPageContent.tsx`参照)。このファイルはそのClient
// Componentから`useEffect`(+`startTransition`)で呼び出すServer Function
// (`"use server"`)として、既存の`listTaxYears`・`getIncomeDeductionEntries`・
// `getOrCreateTaxYear`・`casualtyLossCarryforwardRepository.findByTaxYearId`
// (いずれもリポジトリ抽象経由でPrisma/クライアントDBどちらにも対応済み)をそのまま
// 呼ぶだけの薄いラッパー。`getOrCreateTaxYear`は移行前の`page.tsx`でも呼ばれていた
// (このページを訪れただけで当年のTaxYearレコードが無ければ作成される)既存の挙動の
// ため、そのまま維持する。`lossCarried`クエリ値はDBに依存しない純粋なURL表示フラグ
// のため、このページデータには含めず呼び出し側
// (`CasualtyLossDeductionPageContent.tsx`)で直接`useSearchParams()`から読み取る。
import { getOrCreateTaxYear, listTaxYears } from "@/lib/taxYear";
import { findIncomeDeductionEntry, getIncomeDeductionEntries } from "@/lib/incomeDeduction";
import { casualtyLossCarryforwardRepository } from "@/lib/repositories/defaultCasualtyLossCarryforwardRepository";
import type { CasualtyLossDeductionPageData } from "@/lib/casualtyLossDeductionPageData.types";

export async function getCasualtyLossDeductionPageData(
  yearParam: number | null,
): Promise<CasualtyLossDeductionPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const registeredEntry = findIncomeDeductionEntry(incomeDeductionEntries, "CASUALTY_LOSS");
  const registeredDeduction = registeredEntry
    ? {
        incomeTaxAmountJpy: Number(registeredEntry.incomeTaxAmountJpy),
        residentTaxAmountJpy: Number(registeredEntry.residentTaxAmountJpy),
      }
    : null;

  const taxYear = await getOrCreateTaxYear(year);
  const carryforwards = await casualtyLossCarryforwardRepository.findByTaxYearId(taxYear.id);
  const carryforwardEntries = carryforwards.map((c) => ({
    originYear: c.originYear,
    remainingAmountJpy: c.remainingAmountJpy.toString(),
  }));

  return { year, availableYears, registeredDeduction, carryforwardEntries };
}
