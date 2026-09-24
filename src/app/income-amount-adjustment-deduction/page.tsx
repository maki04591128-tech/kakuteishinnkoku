import Link from "next/link";
import { listTaxYears } from "@/lib/taxYear";
import { findIncomeDeductionEntry, getIncomeDeductionEntries } from "@/lib/incomeDeduction";
import { IncomeAmountAdjustmentDeductionForm } from "./IncomeAmountAdjustmentDeductionForm";

export default async function IncomeAmountAdjustmentDeductionPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const registeredEntry = findIncomeDeductionEntry(
    incomeDeductionEntries,
    "INCOME_AMOUNT_ADJUSTMENT",
  );
  const registeredDeduction = registeredEntry
    ? {
        incomeTaxAmountJpy: Number(registeredEntry.incomeTaxAmountJpy),
        residentTaxAmountJpy: Number(registeredEntry.residentTaxAmountJpy),
      }
    : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          所得金額調整控除額の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          給与収入金額(・公的年金等に係る雑所得の金額)を入力すると、①子育て・特別障害者等の
          所得金額調整控除(給与収入850万円超が対象)と②給与所得・公的年金等に係る雑所得の
          双方がある者に対する所得金額調整控除(措置法41条の3の3)を試算できる。暗号資産・
          投資の集計とは独立した単体の試算画面のため、この年分の取引データには依存しない。
        </p>
      </header>

      <IncomeAmountAdjustmentDeductionForm year={year} registeredDeduction={registeredDeduction} />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        所得金額調整控除は特定支出控除と同様、所得税法上は「所得控除」ではなく給与所得の
        計算上の控除(申告書第一表の給与所得金額欄に反映される)である。本ツールでは
        「給与所得等の課税所得金額」への影響という観点で他の所得控除と同様に扱う簡略化と
        しているため、「この試算結果を{year}年分の所得控除として登録する」ボタンで登録すると、
        `/tax-estimate`の「給与所得等の課税所得金額」の初期値にこの控除額(所得税ベース)が
        自動反映される(登録後も入力欄は手入力で上書き可能)。①の対象となる特別障害者・
        23歳未満の扶養親族の該当性判定はユーザー自身の確認事項であり、この試算では行わない。
      </p>
    </div>
  );
}
