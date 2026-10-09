// スタンドアロン版ビルド用の`@/lib/residentTaxNonTaxablePageData`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ7-3。7-2の
// `basicDeductionPageData.standalone.ts`と同種のパターン)。
//
// 自宅サーバー版は`"use server"`を付けたServer Functionとして実装するが、
// `output: "export"`の静的ビルドでは`"use server"`は使えない
// (フェーズ5-1-3a参照)。呼び出し元(`ResidentTaxNonTaxablePageContent.tsx`、
// `"use client"`コンポーネント)から見た関数シグネチャを変えずに、同じ
// `listTaxYears`を呼ぶ実装に差し替える。これは5-1-3bのビルドターゲット切り替え
// 機構(`defaultTaxYearRepository`)経由で参照するため、このファイル自体は
// Prisma/クライアントDBどちらの実装かを意識しない(スタンドアロンビルドでは
// 自動的にクライアントDB(wa-sqlite/OPFS)側に解決される)。呼び出し元が
// `"use client"`コンポーネントであるため、この関数自体に`"use server"`を付けず
// ただのブラウザ内関数呼び出しとする(自宅サーバー版と違いRPCを経由しない)。
import { listTaxYears } from "@/lib/taxYear";
import type { ResidentTaxNonTaxablePageData } from "@/lib/residentTaxNonTaxablePageData.types";

export async function getResidentTaxNonTaxablePageData(
  yearParam: number | null,
): Promise<ResidentTaxNonTaxablePageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  return { year, availableYears };
}
