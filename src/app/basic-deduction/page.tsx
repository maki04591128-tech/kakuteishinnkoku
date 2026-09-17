import Link from "next/link";
import { listTaxYears } from "@/lib/taxYear";
import { findIncomeDeductionEntry, getIncomeDeductionEntries } from "@/lib/incomeDeduction";
import { BasicDeductionForm } from "./BasicDeductionForm";

export default async function BasicDeductionPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const incomeDeductionEntries = await getIncomeDeductionEntries(year);
  const registeredEntry = findIncomeDeductionEntry(incomeDeductionEntries, "BASIC");
  const registeredDeductionJpy = registeredEntry
    ? Number(registeredEntry.incomeTaxAmountJpy)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          基礎控除額の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          その年の合計所得金額から、基礎控除(所得税法86条・地方税法上の住民税基礎控除)の額を
          試算できる。暗号資産・投資の集計とは独立した単体の試算画面のため、この年分の
          取引データには依存しない。
        </p>
      </header>

      <BasicDeductionForm year={year} registeredDeductionJpy={registeredDeductionJpy} />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        <strong>制約:</strong> 令和7年度税制改正(いわゆる「103万円の壁」対応)により、
        令和7年分(2025年分)・令和8年分(2026年分)以後は所得税の基礎控除額が合計所得金額に
        応じた段階表(132万円以下95万円〜655万円超2,350万円以下58万円)に変わった点に対応した。
        2,350万円超の高所得層側の逓減・消失(2,350万円超2,400万円以下48万円等)は令和2年度
        税制改正以来の既存の仕組みがそのまま適用される。住民税の基礎控除は今回の改正の
        対象外で、年分に関わらず合計所得金額2,400万円以下一律43万円のまま(高所得層側の
        逓減・消失も従来通り)。「この試算結果を{year}年分の所得控除として登録する」
        ボタンで登録すると、`/tax-estimate`の「給与所得等の課税所得金額」の初期値に
        この控除額が自動反映される(登録後も入力欄は手入力で上書き可能)。
      </p>
    </div>
  );
}
