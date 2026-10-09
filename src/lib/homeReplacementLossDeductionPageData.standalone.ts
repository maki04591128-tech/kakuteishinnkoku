// スタンドアロン版ビルド用の`@/lib/homeReplacementLossDeductionPageData`差し替え
// 実装(next.config.tsのresolveAlias経由。フェーズ7-3継続10回目)。
//
// 自宅サーバー版は`"use server"`を付けたServer Functionとして実装するが、
// `output: "export"`の静的ビルドでは`"use server"`は使えない
// (フェーズ5-1-3a参照)。呼び出し元(`HomeReplacementLossDeductionPageContent.tsx`、
// `"use client"`コンポーネント)から見た関数シグネチャを変えずに、同じ
// `listTaxYears`・`getIncomeDeductionEntries`・`getOrCreateTaxYear`・
// `homeReplacementLossCarryforwardRepository.findByTaxYearId`を呼ぶ実装に
// 差し替える。これらは5-1-3bのビルドターゲット切り替え機構経由で参照するため、
// このファイル自体はPrisma/クライアントDBどちらの実装かを意識しない
// (スタンドアロンビルドでは自動的にクライアントDB(wa-sqlite/OPFS)側に解決される)。
// 呼び出し元が`"use client"`コンポーネントであるため、この関数自体に
// `"use server"`を付けずただのブラウザ内関数呼び出しとする(自宅サーバー版と
// 違いRPCを経由しない)。
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
