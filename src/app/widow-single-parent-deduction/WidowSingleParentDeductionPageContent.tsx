"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { WidowSingleParentDeductionForm } from "./WidowSingleParentDeductionForm";
import { getWidowSingleParentDeductionPageData } from "@/lib/widowSingleParentDeductionPageData";
import { useAsyncPageData } from "@/lib/useAsyncPageData";
import { ClientDbErrorNotice } from "@/components/ClientDbErrorNotice";

export function WidowSingleParentDeductionPageContent() {
  const searchParams = useSearchParams();
  const yearParam = Number(searchParams.get("year")) || null;

  const { data, error, isPending } = useAsyncPageData(
    () => getWidowSingleParentDeductionPageData(yearParam),
    [yearParam],
  );

  if (error) {
    return <ClientDbErrorNotice error={error} />;
  }

  if (!data) {
    return <WidowSingleParentDeductionPageSkeleton />;
  }

  const { year, registeredCategoryDeduction, registeredWorkingStudentDeduction } = data;

  return (
    <div
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10"
      aria-busy={isPending}
    >
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          寡婦控除・ひとり親控除・勤労学生控除額の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          寡婦控除・ひとり親控除(選択制のためどちらか一方)と、勤労学生控除
          (寡婦・ひとり親控除とは独立した別要件)を試算できる。暗号資産・投資の
          集計とは独立した単体の試算画面のため、この年分の取引データには依存しない。
        </p>
      </header>

      <WidowSingleParentDeductionForm
        year={year}
        registeredCategoryDeduction={registeredCategoryDeduction}
        registeredWorkingStudentDeduction={registeredWorkingStudentDeduction}
      />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        国税庁タックスアンサーNo.1170(寡婦控除)・No.1171(ひとり親控除)・
        No.1175(勤労学生控除)の速算表による概算値。合計所得金額の要件等の
        適用可否はこの試算では判定しないため、必ず自身で確認すること。
        登録すると、`/tax-estimate`の「給与所得等の課税所得金額」の初期値に
        この控除額(所得税ベース)が自動反映される(登録後も入力欄は手入力で
        上書き可能)。
      </p>
    </div>
  );
}

export function WidowSingleParentDeductionPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <p className="text-sm text-neutral-500">読み込み中…</p>
    </div>
  );
}
