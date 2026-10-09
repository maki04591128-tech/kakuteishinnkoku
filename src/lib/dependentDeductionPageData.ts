"use server";

// 自宅サーバー版の既定実装(フェーズ7-3継続。7-2の`basicDeductionPageData.ts`と
// 同種のパターン)。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により`dependentDeductionPageData.standalone.ts`に
// 差し替えられる。
//
// `/dependent-deduction`ページはフェーズ7-1の決定に従い`"use client"`化し、
// `searchParams`の代わりに`useSearchParams()`で`year`を読み取る構成にした
// (`src/app/dependent-deduction/page.tsx`・`DependentDeductionPageContent.tsx`参照)。
// このファイルはそのClient Componentから`useEffect`(+`startTransition`)で
// 呼び出すServer Function(`"use server"`)として、既存の`listTaxYears`・
// `buildYearReport`・`buildTaxFilingSummary`・`getIncomeDeductionEntries`
// (いずれもリポジトリ抽象経由でPrisma/クライアントDBどちらにも対応済み)を
// そのまま呼ぶだけの薄いラッパー。
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

  // 給与所得等(本ツールが管理しない部分)は他の試算画面と同じ既定値(500万円)を仮定し、
  // 暗号資産・株式等・配当・先物の当年集計値を合算して納税者本人の合計所得金額の初期値とする
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
