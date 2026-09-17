import Link from "next/link";
import { listTaxYears } from "@/lib/taxYear";
import { findIncomeDeductionEntry, getIncomeDeductionEntries } from "@/lib/incomeDeduction";
import { DonationDeductionForm } from "./DonationDeductionForm";

export default async function DonationDeductionPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const registeredEntry = findIncomeDeductionEntry(incomeDeductionEntries, "DONATION");
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
          寄附金控除(ふるさと納税等)額の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          その年に支払った寄附金の合計額(ふるさと納税を含む)を入力すると、所得税の
          寄附金控除額と、住民税の基本控除額・特例控除額(ふるさと納税分)を試算できる。
          `/tax-estimate`の「ふるさと納税の年間上限額の目安」が自己負担2,000円で
          済む寄附額の上限を求めるのに対し、こちらは実際に支払った(または支払う
          予定の)寄附額から控除額そのものを試算する画面。暗号資産・投資の集計とは
          独立した単体の試算画面のため、この年分の取引データには依存しない。
        </p>
      </header>

      <DonationDeductionForm year={year} registeredDeduction={registeredDeduction} />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        所得税法78条(寄附金控除)・地方税法37条の2等に基づく概算値。ワンストップ特例制度は
        考慮していない(確定申告での寄附金控除の適用を前提とする)ため、ワンストップ特例の
        申請をした寄附先がある場合は、確定申告をする時点で全寄附先について寄附金控除の
        対象になる(ワンストップ特例は自動的に無効になる)ことに注意。「住民税所得割額」・
        「所得税の限界税率」は
        <Link href={`/tax-estimate?year=${year}`} className="underline">
          所得税・住民税の概算合計税額試算
        </Link>
        の結果を参考に入力すること。「この試算結果を{year}年分の所得控除として登録する」
        ボタンで登録すると、`/tax-estimate`の「給与所得等の課税所得金額」の初期値に
        所得税分の控除額が自動反映される(登録後も入力欄は手入力で上書き可能)。
      </p>
    </div>
  );
}
