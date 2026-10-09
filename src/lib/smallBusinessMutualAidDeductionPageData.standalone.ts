// スタンドアロン版ビルド用の`@/lib/smallBusinessMutualAidDeductionPageData`
// 差し替え実装(next.config.tsのresolveAlias経由。フェーズ7-3。7-2の
// `basicDeductionPageData.standalone.ts`と同種のパターン)。
//
// 自宅サーバー版は`"use server"`を付けたServer Functionとして実装するが、
// `output: "export"`の静的ビルドでは`"use server"`は使えない
// (フェーズ5-1-3a参照)。呼び出し元(`SmallBusinessMutualAidDeductionPageContent.tsx`、
// `"use client"`コンポーネント)から見た関数シグネチャを変えずに、同じ
// `listTaxYears`・`getIncomeDeductionEntries`を呼ぶ実装に差し替える。これらは
// 5-1-3bのビルドターゲット切り替え機構(`defaultTaxYearRepository`・
// `defaultIncomeDeductionRepository`)経由で参照するため、このファイル自体は
// Prisma/クライアントDBどちらの実装かを意識しない(スタンドアロンビルドでは
// 自動的にクライアントDB(wa-sqlite/OPFS)側に解決される)。呼び出し元が
// `"use client"`コンポーネントであるため、この関数自体に`"use server"`を付けず
// ただのブラウザ内関数呼び出しとする(自宅サーバー版と違いRPCを経由しない)。
import { listTaxYears } from "@/lib/taxYear";
import { findIncomeDeductionEntry, getIncomeDeductionEntries } from "@/lib/incomeDeduction";
import type { SmallBusinessMutualAidDeductionPageData } from "@/lib/smallBusinessMutualAidDeductionPageData.types";

export async function getSmallBusinessMutualAidDeductionPageData(
  yearParam: number | null,
): Promise<SmallBusinessMutualAidDeductionPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const registeredEntry = findIncomeDeductionEntry(
    incomeDeductionEntries,
    "SMALL_BUSINESS_MUTUAL_AID",
  );
  const registeredDeductionJpy = registeredEntry
    ? Number(registeredEntry.incomeTaxAmountJpy)
    : null;

  return { year, availableYears, registeredDeductionJpy };
}
