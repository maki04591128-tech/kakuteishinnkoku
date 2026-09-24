import Link from "next/link";
import { listTaxYears } from "@/lib/taxYear";
import { findIncomeDeductionEntry, getIncomeDeductionEntries } from "@/lib/incomeDeduction";
import { SpecificExpenseDeductionForm } from "./SpecificExpenseDeductionForm";

export default async function SpecificExpenseDeductionPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const registeredEntry = findIncomeDeductionEntry(incomeDeductionEntries, "SPECIFIC_EXPENSE");
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
          給与所得者の特定支出控除額の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          給与収入金額と、給与の支払者から「特定支出に関する証明書」の交付を受けた
          特定支出(通勤費・転居費・研修費・資格取得費・単身赴任者の帰宅旅費・勤務
          必要経費)の区分ごとの年間合計額を入力すると、特定支出の合計額が給与所得
          控除額の1/2を超える部分の金額(特定支出控除額)を試算できる(所得税法57条の2)。
          暗号資産・投資の集計とは独立した単体の試算画面のため、この年分の取引データ
          には依存しない。
        </p>
      </header>

      <SpecificExpenseDeductionForm year={year} registeredDeduction={registeredDeduction} />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        特定支出控除は他の所得控除試算画面とは異なり、所得税法上は「所得控除」ではなく
        給与所得の計算上の控除(申告書第一表の給与所得金額欄に反映される)である。
        本ツールでは「給与所得等の課税所得金額」への影響という観点で他の所得控除と
        同様に扱う簡略化としているため、「この試算結果を{year}年分の所得控除として
        登録する」ボタンで登録すると、`/tax-estimate`の「給与所得等の課税所得金額」の
        初期値にこの控除額(所得税ベース)が自動反映される(登録後も入力欄は手入力で
        上書き可能)。各特定支出が証明書の要件を満たすかどうかの判定はユーザー自身の
        確認事項であり、この試算では行わない。
      </p>
    </div>
  );
}
