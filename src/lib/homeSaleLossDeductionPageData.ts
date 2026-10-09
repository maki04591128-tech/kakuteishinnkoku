"use server";

// 自宅サーバー版の既定実装(フェーズ7-3継続11回目。7-2の`basicDeductionPageData.ts`と
// 同種のパターン)。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)ではnext.config.ts
// のresolveAlias設定により`homeSaleLossDeductionPageData.standalone.ts`に
// 差し替えられる。
//
// `/home-sale-loss-deduction`ページはフェーズ7-1の決定に従い`"use client"`化し、
// `searchParams`の代わりに`useSearchParams()`で`year`を読み取る構成にした
// (`src/app/home-sale-loss-deduction/page.tsx`・
// `HomeSaleLossDeductionPageContent.tsx`参照)。このファイルはそのClient
// Componentから`useEffect`(+`startTransition`)で呼び出すServer Function
// (`"use server"`)として、既存の`listTaxYears`・`getIncomeDeductionEntries`・
// `getOrCreateTaxYear`・`homeSaleLossCarryforwardRepository.findByTaxYearId`
// (いずれもリポジトリ抽象経由でPrisma/クライアントDBどちらにも対応済み)をそのまま
// 呼ぶだけの薄いラッパー。`getOrCreateTaxYear`は移行前の`page.tsx`でも呼ばれていた
// (このページを訪れただけで当年のTaxYearレコードが無ければ作成される)既存の挙動の
// ため、そのまま維持する。`lossCarried`クエリ値はDBに依存しない純粋なURL表示フラグ
// のため、このページデータには含めず呼び出し側
// (`HomeSaleLossDeductionPageContent.tsx`)で直接`useSearchParams()`から
// 読み取る。
import { getOrCreateTaxYear, listTaxYears } from "@/lib/taxYear";
import { findIncomeDeductionEntry, getIncomeDeductionEntries } from "@/lib/incomeDeduction";
import { homeSaleLossCarryforwardRepository } from "@/lib/repositories/defaultHomeSaleLossCarryforwardRepository";
import type { HomeSaleLossDeductionPageData } from "@/lib/homeSaleLossDeductionPageData.types";

export async function getHomeSaleLossDeductionPageData(
  yearParam: number | null,
): Promise<HomeSaleLossDeductionPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const registeredEntry = findIncomeDeductionEntry(incomeDeductionEntries, "HOME_SALE_LOSS");
  const registeredDeduction = registeredEntry
    ? {
        incomeTaxAmountJpy: Number(registeredEntry.incomeTaxAmountJpy),
        residentTaxAmountJpy: Number(registeredEntry.residentTaxAmountJpy),
      }
    : null;

  const taxYear = await getOrCreateTaxYear(year);
  const carryforwards = await homeSaleLossCarryforwardRepository.findByTaxYearId(taxYear.id);
  const carryforwardEntries = carryforwards.map((c) => ({
    originYear: c.originYear,
    remainingAmountJpy: c.remainingAmountJpy.toString(),
  }));

  return { year, availableYears, registeredDeduction, carryforwardEntries };
}
