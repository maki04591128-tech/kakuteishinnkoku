import Link from "next/link";
import { listTaxYears } from "@/lib/taxYear";
import { ResidentTaxNonTaxableForm } from "./ResidentTaxNonTaxableForm";

export default async function ResidentTaxNonTaxablePage({
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
          住民税(所得割・均等割)の非課税判定({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          合計所得金額・扶養親族の人数を入力すると、個人住民税の所得割・均等割それぞれが
          非課税になるかどうかを試算する(地方税法24条の5・295条)。障害者・未成年者・
          寡婦・ひとり親のいずれかに該当する場合は、前年の合計所得金額が135万円以下なら
          この判定とは別に非課税になる。暗号資産・投資の集計とは独立した単体の試算画面の
          ため、この年分の取引データには依存しない。
        </p>
      </header>

      <ResidentTaxNonTaxableForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        非課税限度額は市区町村の条例で定める「級地区分」によって係数(35万円/31.5万円/
        28万円)が異なる概算値であり、生活保護法の生活扶助を受けている場合の非課税は
        判定対象外。実際の非課税判定は必ず居住する市区町村の公式情報で確認すること。
      </p>
    </div>
  );
}
