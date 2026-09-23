import Link from "next/link";
import { listTaxYears } from "@/lib/taxYear";
import { ResidentTaxAdjustmentDeductionForm } from "./ResidentTaxAdjustmentDeductionForm";

export default async function ResidentTaxAdjustmentDeductionPage({
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
          住民税の調整控除の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          税源移譲に伴い生じる所得税と住民税の人的控除額(基礎控除・配偶者控除・
          扶養控除・障害者控除・寡婦控除・ひとり親控除・勤労学生控除)の差に基づく
          負担増を調整する「調整控除」の額を試算する。他の所得控除試算画面と同様、
          暗号資産・投資の集計とは独立した単体の試算画面のため、この年分の取引データには
          依存しない。
        </p>
      </header>

      <ResidentTaxAdjustmentDeductionForm year={year} />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        自治体公式サイト(洲本市「個人市県民税の税額控除(令和8年度課税以降適用)」等)で
        内容が確認できた人的控除額の差の速算表・計算式による概算値。配偶者特別控除・
        特定親族特別控除は人的控除額の差の対象外。市民税(町村民税)3%・道府県民税
        (都民税)2%の内訳は本アプリでは住民税分として合算して表示する。
        `/tax-estimate`への自動反映は引き続き今後の課題(README「ロードマップ」参照)。
      </p>
    </div>
  );
}
