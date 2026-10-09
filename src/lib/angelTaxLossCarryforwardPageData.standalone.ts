// スタンドアロン版ビルド用の`@/lib/angelTaxLossCarryforwardPageData`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ7-3。7-2の
// `basicDeductionPageData.standalone.ts`と同種のパターン)。
//
// 自宅サーバー版は`"use server"`を付けたServer Functionとして実装するが、
// `output: "export"`の静的ビルドでは`"use server"`は使えない
// (フェーズ5-1-3a参照)。呼び出し元(`AngelTaxLossCarryforwardPageContent.tsx`、
// `"use client"`コンポーネント)から見た関数シグネチャを変えずに、同じ
// `listTaxYears`・`getOrCreateTaxYear`・
// `angelTaxLossCarryforwardRepository.findByTaxYearId`を呼ぶ実装に差し替える。
// これらは5-1-3bのビルドターゲット切り替え機構
// (`defaultTaxYearRepository`・`defaultAngelTaxLossCarryforwardRepository`)経由で
// 参照するため、このファイル自体はPrisma/クライアントDBどちらの実装かを意識しない
// (スタンドアロンビルドでは自動的にクライアントDB(wa-sqlite/OPFS)側に解決される)。
// 呼び出し元が`"use client"`コンポーネントであるため、この関数自体に`"use server"`を
// 付けずただのブラウザ内関数呼び出しとする(自宅サーバー版と違いRPCを経由しない)。
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
