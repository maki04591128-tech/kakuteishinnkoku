import Link from "next/link";
import { buildYearReport } from "@/lib/reporting";
import { buildTaxFilingSummary } from "@/lib/etax/summary";
import { listTaxYears } from "@/lib/taxYear";
import { findIncomeDeductionEntry, getIncomeDeductionEntries } from "@/lib/incomeDeduction";
import { DependentDeductionForm } from "./DependentDeductionForm";

export default async function DependentDeductionPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          配偶者控除・配偶者特別控除・扶養控除の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          配偶者・扶養親族の合計所得金額と年齢から、配偶者控除・配偶者特別控除
          (所得税法83条・83条の2)、扶養控除(同法84条)の額を試算する。納税者本人の
          合計所得金額の初期値は、この年の暗号資産・株式等・配当・先物の集計値と、
          給与所得等の仮定値(500万円)を合算した金額を表示している。
        </p>
      </header>

      <DependentDeductionForm
        year={year}
        defaultTaxpayerTotalIncomeJpy={defaultTaxpayerTotalIncomeJpy}
        registeredSpouseDeductionJpy={registeredSpouseDeductionJpy}
        registeredDependentDeductionJpy={registeredDependentDeductionJpy}
      />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        <strong>制約:</strong> 令和6年分(2024年分)以前の所得要件・控除額表による試算。
        令和7年度税制改正(いわゆる「103万円の壁」対応。扶養親族等の合計所得金額要件の
        48万円→58万円への変更、配偶者特別控除の対象所得の上限引き上げ、19〜22歳の親族
        向けに新設された「特定親族特別控除」等)には未対応。令和7年分(2025年分)以降の
        申告では、国税庁「確定申告書等作成コーナー」の最新の所得要件・控除額で計算し
        直すこと。「この試算結果を{year}年分の所得控除として登録する」ボタンで登録すると、
        `/tax-estimate`の「給与所得等の課税所得金額」の初期値にこの控除額が自動反映される
        (登録後も入力欄は手入力で上書き可能)。
      </p>
    </div>
  );
}
