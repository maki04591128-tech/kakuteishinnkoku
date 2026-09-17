import Link from "next/link";
import { listTaxYears } from "@/lib/taxYear";
import { findIncomeDeductionEntry, getIncomeDeductionEntries } from "@/lib/incomeDeduction";
import { EarthquakeInsuranceDeductionForm } from "./EarthquakeInsuranceDeductionForm";

export default async function EarthquakeInsuranceDeductionPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const registeredEntry = findIncomeDeductionEntry(incomeDeductionEntries, "EARTHQUAKE_INSURANCE");
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
          地震保険料控除額の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          損害保険会社発行の控除証明書に記載された年間払込保険料額を、地震保険料と
          旧長期損害保険料(2006年12月31日までに締結した満期返戻金のある保険期間10年以上の
          契約・経過措置対象)の区分ごとに入力すると、国税庁の計算方法による所得税・住民税の
          控除額を試算できる。暗号資産・投資の集計とは独立した単体の試算画面のため、
          この年分の取引データには依存しない。
        </p>
      </header>

      <EarthquakeInsuranceDeductionForm year={year} registeredDeduction={registeredDeduction} />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        国税庁の地震保険料控除の計算方法による概算値であり、実際の控除額は損害保険会社発行の
        控除証明書の金額で確認すること。1つの契約が地震保険料・旧長期損害保険料の両方の
        要件を満たす場合はいずれか一方の選択制のため、区分はユーザー自身で確認すること。
        「この試算結果を{year}年分の所得控除として登録する」ボタンで登録すると、
        `/tax-estimate`の「給与所得等の課税所得金額」の初期値にこの控除額(所得税ベース)が
        自動反映される(登録後も入力欄は手入力で上書き可能)。
      </p>
    </div>
  );
}
