import Link from "next/link";
import { listTaxYears } from "@/lib/taxYear";
import { findIncomeDeductionEntry, getIncomeDeductionEntries } from "@/lib/incomeDeduction";
import { CasualtyLossDeductionForm } from "./CasualtyLossDeductionForm";

export default async function CasualtyLossDeductionPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const registeredEntry = findIncomeDeductionEntry(incomeDeductionEntries, "CASUALTY_LOSS");
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
          雑損控除額の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          災害・盗難・横領により住宅家財等の生活用資産に損害を受けた場合の雑損控除額を、
          国税庁の計算式に基づいて試算できる。暗号資産・投資の集計とは独立した単体の
          試算画面のため、この年分の取引データには依存しない。
        </p>
      </header>

      <CasualtyLossDeductionForm year={year} registeredDeduction={registeredDeduction} />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        国税庁タックスアンサーNo.1110の計算式による概算値であり、損害金額の算定方法や
        適用要件(災害・盗難・横領による損失であること等)は必ず自身で確認すること。
        「この試算結果を{year}年分の所得控除として登録する」ボタンで登録すると、
        `/tax-estimate`の「給与所得等の課税所得金額」の初期値にこの控除額(所得税ベース)が
        自動反映される(登録後も入力欄は手入力で上書き可能)。控除しきれなかった金額を
        翌年以後に繰り越す「雑損失の繰越控除」は未対応。
      </p>
    </div>
  );
}
