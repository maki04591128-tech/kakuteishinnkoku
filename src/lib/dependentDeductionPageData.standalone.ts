// スタンドアロン版ビルド用の`@/lib/dependentDeductionPageData`差し替え実装
// (next.config.tsのresolveAlias経由。フェーズ7-3継続)。
//
// 自宅サーバー版は`"use server"`を付けたServer Functionとして実装するが、
// `output: "export"`の静的ビルドでは`"use server"`は使えない
// (フェーズ5-1-3a参照)。呼び出し元(`DependentDeductionPageContent.tsx`、
// `"use client"`コンポーネント)から見た関数シグネチャを変えずに、同じ
// `listTaxYears`・`buildYearReport`・`buildTaxFilingSummary`・
// `getIncomeDeductionEntries`を呼ぶ実装に差し替える。これらは5-1-3bの
// ビルドターゲット切り替え機構経由で参照するため、このファイル自体は
// Prisma/クライアントDBどちらの実装かを意識しない(スタンドアロンビルドでは
// 自動的にクライアントDB(wa-sqlite/OPFS)側に解決される)。呼び出し元が
// `"use client"`コンポーネントであるため、この関数自体に`"use server"`を付けず
// ただのブラウザ内関数呼び出しとする(自宅サーバー版と違いRPCを経由しない)。
import { buildYearReport } from "@/lib/reporting";
import { buildTaxFilingSummary } from "@/lib/etax/summary";
import { listTaxYears } from "@/lib/taxYear";
import { findIncomeDeductionEntry, getIncomeDeductionEntries } from "@/lib/incomeDeduction";
import type { DependentDeductionPageData } from "@/lib/dependentDeductionPageData.types";

export async function getDependentDeductionPageData(
  yearParam: number | null,
): Promise<DependentDeductionPageData> {
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = yearParam || availableYears[0] || currentCalendarYear;

  const report = await buildYearReport(year);
  const summary = report
    ? buildTaxFilingSummary(
        year,
        report.crypto,
        report.investment,
        report.lossCarryforward,
        report.cryptoMargin,
        report.futures,
        report.futuresLossCarryforward,
      )
    : null;

  const defaultTaxpayerTotalIncomeJpy =
    5_000_000 +
    (summary?.cryptoMiscIncomeJpy.toNumber() ?? 0) +
    (summary?.investmentLossCarryforward.taxableGainJpy.toNumber() ?? 0) +
    (summary?.investmentDividendJpy.toNumber() ?? 0) +
    (report?.futuresLossCarryforward.taxableGainJpy.toNumber() ?? 0);

  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const registeredSpouseEntry = findIncomeDeductionEntry(incomeDeductionEntries, "SPOUSE");
  const registeredSpouseDeductionJpy = registeredSpouseEntry
    ? Number(registeredSpouseEntry.incomeTaxAmountJpy)
    : null;
  const registeredDependentEntry = findIncomeDeductionEntry(incomeDeductionEntries, "DEPENDENT");
  const registeredDependentDeductionJpy = registeredDependentEntry
    ? Number(registeredDependentEntry.incomeTaxAmountJpy)
    : null;

  return {
    year,
    availableYears,
    defaultTaxpayerTotalIncomeJpy,
    registeredSpouseDeductionJpy,
    registeredDependentDeductionJpy,
  };
}
