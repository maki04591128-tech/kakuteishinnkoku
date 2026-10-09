"use server";

// 自宅サーバー版の既定実装(フェーズ7-3継続11回目。7-2の`basicDeductionPageData.ts`と
// 同種のパターン)。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)ではnext.config.ts
// のresolveAlias設定により`medicalExpenseDeductionPageData.standalone.ts`に
// 差し替えられる。
//
// `/medical-expense-deduction`ページはフェーズ7-1の決定に従い`"use client"`化し、
// `searchParams`の代わりに`useSearchParams()`で`year`を読み取る構成にした
// (`src/app/medical-expense-deduction/page.tsx`・
// `MedicalExpenseDeductionPageContent.tsx`参照)。このファイルはそのClient
// Componentから`useEffect`(+`startTransition`)で呼び出すServer Function
// (`"use server"`)として、既存の`buildYearReport`・`buildTaxFilingSummary`・
// `listTaxYears`・`getIncomeDeductionEntries`(いずれもリポジトリ抽象経由で
// Prisma/クライアントDBどちらにも対応済み)をそのまま呼ぶだけの薄いラッパー。
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

  // 給与所得等(本ツールが管理しない部分)は概算試算と同じ既定値(500万円)を仮定し、
  // 暗号資産・株式等・配当・先物の当年集計値を合算して総所得金額等の初期値とする
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
