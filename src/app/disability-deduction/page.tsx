import Link from "next/link";
import { listTaxYears } from "@/lib/taxYear";
import { findIncomeDeductionEntry, getIncomeDeductionEntries } from "@/lib/incomeDeduction";
import { DisabilityDeductionForm } from "./DisabilityDeductionForm";

export default async function DisabilityDeductionPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const registeredEntry = findIncomeDeductionEntry(incomeDeductionEntries, "DISABILITY");
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
          障害者控除額の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          納税者本人と、同一生計配偶者・扶養親族のうち障害者に該当する人数を区分ごとに
          入力すると、国税庁の速算表による所得税・住民税の控除額を試算できる。暗号資産・
          投資の集計とは独立した単体の試算画面のため、この年分の取引データには依存しない。
        </p>
      </header>

      <DisabilityDeductionForm year={year} registeredDeduction={registeredDeduction} />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        国税庁タックスアンサーNo.1160の速算表による概算値であり、実際の適用可否
        (障害者手帳の等級等)は市区町村・税務署の基準で確認すること。
        「この試算結果を{year}年分の所得控除として登録する」ボタンで登録すると、
        `/tax-estimate`の「給与所得等の課税所得金額」の初期値にこの控除額(所得税ベース)が
        自動反映される(登録後も入力欄は手入力で上書き可能)。
      </p>
    </div>
  );
}
