// スタンドアロン版ビルド用の`@/lib/medicalExpenseDeductionPageData`差し替え
// 実装(next.config.tsのresolveAlias経由。フェーズ7-3継続11回目)。
//
// 自宅サーバー版は`"use server"`を付けたServer Functionとして実装するが、
// `output: "export"`の静的ビルドでは`"use server"`は使えない
// (フェーズ5-1-3a参照)。呼び出し元(`MedicalExpenseDeductionPageContent.tsx`、
// `"use client"`コンポーネント)から見た関数シグネチャを変えずに、同じ
// `buildYearReport`・`buildTaxFilingSummary`・`listTaxYears`・
// `getIncomeDeductionEntries`を呼ぶ実装に差し替える。これらは5-1-3bの
// ビルドターゲット切り替え機構経由で参照するため、このファイル自体は
// Prisma/クライアントDBどちらの実装かを意識しない(スタンドアロンビルドでは
// 自動的にクライアントDB(wa-sqlite/OPFS)側に解決される)。呼び出し元が
// `"use client"`コンポーネントであるため、この関数自体に`"use server"`を
// 付けずただのブラウザ内関数呼び出しとする(自宅サーバー版と違いRPCを
// 経由しない)。
import { buildYearReport } from "@/lib/reporting";
import { buildTaxFilingSummary } from "@/lib/etax/summary";
import { listTaxYears } from "@/lib/taxYear";
import { findIncomeDeductionEntry, getIncomeDeductionEntries } from "@/lib/incomeDeduction";
import type { MedicalExpenseDeductionPageData } from "@/lib/medicalExpenseDeductionPageData.types";

export async function getMedicalExpenseDeductionPageData(
  yearParam: number | null,
): Promise<MedicalExpenseDeductionPageData> {
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

  const defaultTotalIncomeJpy =
    5_000_000 +
    (summary?.cryptoMiscIncomeJpy.toNumber() ?? 0) +
    (summary?.investmentLossCarryforward.taxableGainJpy.toNumber() ?? 0) +
    (summary?.investmentDividendJpy.toNumber() ?? 0) +
    (report?.futuresLossCarryforward.taxableGainJpy.toNumber() ?? 0);

  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const registeredEntry = findIncomeDeductionEntry(incomeDeductionEntries, "MEDICAL_EXPENSE");
  const registeredDeductionJpy = registeredEntry
    ? Number(registeredEntry.incomeTaxAmountJpy)
    : null;
  const registeredSelfMedicationEntry = findIncomeDeductionEntry(
    incomeDeductionEntries,
    "SELF_MEDICATION",
  );
  const registeredSelfMedicationDeductionJpy = registeredSelfMedicationEntry
    ? Number(registeredSelfMedicationEntry.incomeTaxAmountJpy)
    : null;

  return {
    year,
    availableYears,
    defaultTotalIncomeJpy,
    registeredDeductionJpy,
    registeredSelfMedicationDeductionJpy,
  };
}
