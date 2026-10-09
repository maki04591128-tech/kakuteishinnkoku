// スタンドアロン版ビルド用の`@/lib/barrierFreeRenovationDeductionPageData`差し替え
// 実装(next.config.tsのresolveAlias経由。フェーズ7-3。7-2の
// `basicDeductionPageData.standalone.ts`と同種のパターン)。
//
// 自宅サーバー版は`"use server"`を付けたServer Functionとして実装するが、
// `output: "export"`の静的ビルドでは`"use server"`は使えない
// (フェーズ5-1-3a参照)。呼び出し元(`BarrierFreeRenovationDeductionPageContent.tsx`、
// `"use client"`コンポーネント)から見た関数シグネチャを変えずに、同じ
// `listTaxYears`・`getBarrierFreeRenovationDeductionRecord`を呼ぶ実装に差し替える。
// これらは5-1-3bのビルドターゲット切り替え機構
// (`defaultTaxYearRepository`・
// `defaultBarrierFreeRenovationDeductionRecordRepository`)経由で参照するため、
// このファイル自体はPrisma/クライアントDBどちらの実装かを意識しない
// (スタンドアロンビルドでは自動的にクライアントDB(wa-sqlite/OPFS)側に解決される)。
// 呼び出し元が`"use client"`コンポーネントであるため、この関数自体に`"use server"`を
// 付けずただのブラウザ内関数呼び出しとする(自宅サーバー版と違いRPCを経由しない)。
import { listTaxYears } from "@/lib/taxYear";
import { getBarrierFreeRenovationDeductionRecord } from "@/lib/barrierFreeRenovationDeduction";
import type { BarrierFreeRenovationDeductionPageData } from "@/lib/barrierFreeRenovationDeductionPageData.types";

export async function getBarrierFreeRenovationDeductionPageData(
  yearParam: number | null,
): Promise<BarrierFreeRenovationDeductionPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const registeredRecord = await getBarrierFreeRenovationDeductionRecord(year);
  const registeredCreditJpy = registeredRecord ? registeredRecord.creditJpy.toNumber() : null;

  return { year, availableYears, registeredCreditJpy };
}
