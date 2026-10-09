// スタンドアロン版ビルド用の
// `@/lib/durabilityImprovementRenovationDeductionPageData`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ7-3。7-2の
// `basicDeductionPageData.standalone.ts`と同種のパターン)。
//
// 自宅サーバー版は`"use server"`を付けたServer Functionとして実装するが、
// `output: "export"`の静的ビルドでは`"use server"`は使えない
// (フェーズ5-1-3a参照)。呼び出し元
// (`DurabilityImprovementRenovationDeductionPageContent.tsx`、`"use client"`
// コンポーネント)から見た関数シグネチャを変えずに、同じ`listTaxYears`・
// `getDurabilityImprovementRenovationDeductionRecord`を呼ぶ実装に差し替える。
// これらは5-1-3bのビルドターゲット切り替え機構
// (`defaultTaxYearRepository`・
// `defaultDurabilityImprovementRenovationDeductionRecordRepository`)経由で
// 参照するため、このファイル自体はPrisma/クライアントDBどちらの実装かを意識しない
// (スタンドアロンビルドでは自動的にクライアントDB(wa-sqlite/OPFS)側に解決される)。
// 呼び出し元が`"use client"`コンポーネントであるため、この関数自体に`"use server"`を
// 付けずただのブラウザ内関数呼び出しとする(自宅サーバー版と違いRPCを経由しない)。
import { listTaxYears } from "@/lib/taxYear";
import { getDurabilityImprovementRenovationDeductionRecord } from "@/lib/durabilityImprovementRenovationDeduction";
import type { DurabilityImprovementRenovationDeductionPageData } from "@/lib/durabilityImprovementRenovationDeductionPageData.types";

export async function getDurabilityImprovementRenovationDeductionPageData(
  yearParam: number | null,
): Promise<DurabilityImprovementRenovationDeductionPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const registeredRecord = await getDurabilityImprovementRenovationDeductionRecord(year);
  const registeredCreditJpy = registeredRecord ? registeredRecord.creditJpy.toNumber() : null;

  return { year, availableYears, registeredCreditJpy };
}
