import Link from "next/link";
import { listTaxYears } from "@/lib/taxYear";
import { LifeInsuranceDeductionForm } from "./LifeInsuranceDeductionForm";

export default async function LifeInsuranceDeductionPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const availableYears = await listTaxYears();
  const currentCalendarYear = new Date().getFullYear();
  const year = Number(params.year) || availableYears[0] || currentCalendarYear;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          生命保険料控除額の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          生命保険会社発行の控除証明書に記載された年間払込保険料額を区分(一般生命保険料・
          介護医療保険料・個人年金保険料)ごとに、新制度(2012年1月1日以後の契約)・旧制度
          (2011年12月31日以前の契約)に分けて入力すると、国税庁の速算表による所得税・住民税の
          控除額を試算できる。暗号資産・投資の集計とは独立した単体の試算画面のため、
          この年分の取引データには依存しない。
        </p>
      </header>

      <LifeInsuranceDeductionForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        国税庁の生命保険料控除の速算表による概算値であり、実際の控除額は生命保険会社発行の
        控除証明書の金額で確認すること。区分ごとに新旧両方の契約がある場合は、新制度分のみ・
        旧制度分のみ・新旧合算のうち最も有利な金額を自動的に選択している。ここで求めた
        控除額は、他の試算画面の所得金額等には自動反映されないため、該当の入力欄から
        別途差し引くこと。
      </p>
    </div>
  );
}
