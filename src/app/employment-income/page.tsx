import Link from "next/link";
import { listTaxYears } from "@/lib/taxYear";
import { getEmploymentIncomeRecord } from "@/lib/employmentIncome";
import { EmploymentIncomeForm } from "./EmploymentIncomeForm";

export default async function EmploymentIncomePage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    employmentIncomeSaved?: string;
    employmentIncomeDeleted?: string;
  }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  const record = await getEmploymentIncomeRecord(year);
  const registeredRecord = record
    ? {
        taxYear: record.taxYear,
        grossSalaryJpy: record.grossSalaryJpy.toNumber(),
        employmentIncomeJpy: record.employmentIncomeJpy.toNumber(),
      }
    : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">給与所得の試算({year}年分)</h1>
        <p className="mt-1 text-sm text-neutral-500">
          給与収入金額(源泉徴収票の「支払金額」)を入力すると、給与所得控除額と給与所得金額を
          試算できる。暗号資産・投資の集計とは独立した単体の試算画面のため、この年分の取引
          データには依存しない。試算結果は「登録する」ボタンで年分ごとに保存でき、
          <Link href="/tax-estimate" className="underline">
            /tax-estimate
          </Link>
          の「給与所得等の課税所得金額」の初期値に自動反映される(これまで実際の給与収入額と
          無関係な固定値(500万円)を初期値に使っていた点への対応。初期値のみで、手入力で
          上書き可能)。
        </p>
      </header>

      {params.employmentIncomeSaved !== undefined && (
        <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          {year}年分の給与収入を登録しました。`/tax-estimate`の初期値に自動反映されます。
        </p>
      )}
      {params.employmentIncomeDeleted !== undefined && (
        <p className="rounded-md bg-neutral-100 px-4 py-2 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
          {year}年分の給与収入の登録を削除しました。
        </p>
      )}

      <EmploymentIncomeForm year={year} registeredRecord={registeredRecord} />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        給与所得控除額は所得税法28条3項の速算表による概算値(1円単位の端数処理は行わない)。
        2か所以上から給与の支払を受ける場合は、その年の給与収入金額の合計額を入力すること。
        所得金額調整控除(給与収入850万円超の子育て・特別障害者等、または給与所得・公的年金等
        双方の所得がある場合)・特定支出控除の適用がある場合は、それぞれ
        <Link href="/income-amount-adjustment-deduction" className="underline">
          /income-amount-adjustment-deduction
        </Link>
        ・
        <Link href="/specific-expense-deduction" className="underline">
          /specific-expense-deduction
        </Link>
        から別途「所得控除として登録する」ことで`/tax-estimate`の初期値にあわせて反映される。
      </p>
    </div>
  );
}
