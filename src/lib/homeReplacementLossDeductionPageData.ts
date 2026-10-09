"use server";

// 自宅サーバー版の既定実装(フェーズ7-3継続10回目。7-2の`basicDeductionPageData.ts`と
// 同種のパターン)。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)ではnext.config.ts
// のresolveAlias設定により`homeReplacementLossDeductionPageData.standalone.ts`に
// 差し替えられる。
//
// `/home-replacement-loss-deduction`ページはフェーズ7-1の決定に従い`"use client"`化し、
// `searchParams`の代わりに`useSearchParams()`で`year`を読み取る構成にした
// (`src/app/home-replacement-loss-deduction/page.tsx`・
// `HomeReplacementLossDeductionPageContent.tsx`参照)。このファイルはそのClient
// Componentから`useEffect`(+`startTransition`)で呼び出すServer Function
// (`"use server"`)として、既存の`listTaxYears`・`getIncomeDeductionEntries`・
// `getOrCreateTaxYear`・`homeReplacementLossCarryforwardRepository.findByTaxYearId`
// (いずれもリポジトリ抽象経由でPrisma/クライアントDBどちらにも対応済み)をそのまま
// 呼ぶだけの薄いラッパー。`getOrCreateTaxYear`は移行前の`page.tsx`でも呼ばれていた
// (このページを訪れただけで当年のTaxYearレコードが無ければ作成される)既存の挙動の
// ため、そのまま維持する。`lossCarried`クエリ値はDBに依存しない純粋なURL表示フラグ
// のため、このページデータには含めず呼び出し側
// (`HomeReplacementLossDeductionPageContent.tsx`)で直接`useSearchParams()`から
// 読み取る。
import { getOrCreateTaxYear, listTaxYears } from "@/lib/taxYear";
import { findIncomeDeductionEntry, getIncomeDeductionEntries } from "@/lib/incomeDeduction";
import { homeReplacementLossCarryforwardRepository } from "@/lib/repositories/defaultHomeReplacementLossCarryforwardRepository";
import type { HomeReplacementLossDeductionPageData } from "@/lib/homeReplacementLossDeductionPageData.types";

export async function getHomeReplacementLossDeductionPageData(
  yearParam: number | null,
): Promise<HomeReplacementLossDeductionPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const registeredEntry = findIncomeDeductionEntry(incomeDeductionEntries, "HOME_REPLACEMENT_LOSS");
  const registeredDeduction = registeredEntry
    ? {
        incomeTaxAmountJpy: Number(registeredEntry.incomeTaxAmountJpy),
        residentTaxAmountJpy: Number(registeredEntry.residentTaxAmountJpy),
      }
    : null;

  const taxYear = await getOrCreateTaxYear(year);
  const carryforwards = await homeReplacementLossCarryforwardRepository.findByTaxYearId(taxYear.id);
  const carryforwardEntries = carryforwards.map((c) => ({
    originYear: c.originYear,
    remainingAmountJpy: c.remainingAmountJpy.toString(),
  }));

  return { year, availableYears, registeredDeduction, carryforwardEntries };
}
