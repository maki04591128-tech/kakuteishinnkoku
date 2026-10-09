"use server";

// 自宅サーバー版の既定実装(フェーズ7-3。7-2の`basicDeductionPageData.ts`と同種の
// パターン)。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)ではnext.config.ts
// のresolveAlias設定により`angelTaxLossCarryforwardPageData.standalone.ts`に
// 差し替えられる。
//
// `/angel-tax-loss-carryforward`ページはフェーズ7-1の決定に従い`"use client"`化し、
// `searchParams`の代わりに`useSearchParams()`で`year`を読み取る構成にした
// (`src/app/angel-tax-loss-carryforward/page.tsx`・
// `AngelTaxLossCarryforwardPageContent.tsx`参照)。このファイルはそのClient
// Componentから`useEffect`(+`startTransition`)で呼び出すServer Function
// (`"use server"`)として、既存の`listTaxYears`・`getOrCreateTaxYear`・
// `angelTaxLossCarryforwardRepository.findByTaxYearId`(いずれもリポジトリ抽象経由で
// Prisma/クライアントDBどちらにも対応済み)をそのまま呼ぶだけの薄いラッパー。
// `getOrCreateTaxYear`は移行前の`page.tsx`でも呼ばれていた(このページを訪れただけで
// 当年のTaxYearレコードが無ければ作成される)既存の挙動のため、そのまま維持する。
import { getOrCreateTaxYear, listTaxYears } from "@/lib/taxYear";
import { angelTaxLossCarryforwardRepository } from "@/lib/repositories/defaultAngelTaxLossCarryforwardRepository";
import type { AngelTaxLossCarryforwardPageData } from "@/lib/angelTaxLossCarryforwardPageData.types";

export async function getAngelTaxLossCarryforwardPageData(
  yearParam: number | null,
): Promise<AngelTaxLossCarryforwardPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const taxYear = await getOrCreateTaxYear(year);
  const carryforwards = await angelTaxLossCarryforwardRepository.findByTaxYearId(taxYear.id);
  const carryforwardEntries = carryforwards.map((c) => ({
    id: c.id,
    originYear: c.originYear,
    remainingAmountJpy: c.remainingAmountJpy.toString(),
  }));

  return { year, availableYears, carryforwardEntries };
}
