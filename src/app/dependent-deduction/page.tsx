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
        <strong>制約:</strong> 扶養親族・同一生計配偶者の合計所得金額要件は年分
        ({year}年分)に応じて自動的に切り替える(令和8年度税制改正により令和8年分・
        2026年分以後は62万円、令和7年度税制改正により令和7年分・2025年分は58万円、
        令和6年分・2024年分以前は48万円)。配偶者特別控除は上限(133万円)・控除額の
        段階表自体に変更が無いため、この要件緩和の反映のみで対応できている。
        19〜22歳の親族向けに新設された「特定親族特別控除」(合計所得金額の下限超・
        上限123万円以下。下限は上記と同じく年分に応じて58万円/62万円に切り替わる)
        にも対応した。所得税側は5万円刻みの控除額の段階表(下限超85万円以下63万円〜
        120万円超123万円以下3万円。令和8年分以後もこの段階表自体は変わらず、
        下限のみ58万円→62万円になる)をそのまま実装し、住民税側も満額(45万円)の
        対象範囲(下限超95万円以下)、および95万円超123万円以下の逓減額
        (所得税側と同額)の両方に対応した。基礎控除の引き上げは
        `/basic-deduction`に分離して実装した。「この試算結果を{year}年分の
        所得控除として登録する」ボタンで登録すると、`/tax-estimate`の
        「給与所得等の課税所得金額」の初期値にこの控除額が自動反映される
        (登録後も入力欄は手入力で上書き可能)。
      </p>
    </div>
  );
}
