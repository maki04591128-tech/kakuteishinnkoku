import Link from "next/link";
import { listTaxYears } from "@/lib/taxYear";
import { SocialInsuranceDeductionForm } from "./SocialInsuranceDeductionForm";

export default async function SocialInsuranceDeductionPage({
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
          社会保険料控除額の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          国民年金・国民健康保険・厚生年金・雇用保険等、その年に支払った社会保険料の
          区分ごとの金額を入力すると、その合計額(全額控除、上限なし)を試算できる。
          生計を一にする配偶者その他の親族の社会保険料を本人が支払った場合も含められる。
          暗号資産・投資の集計とは独立した単体の試算画面のため、この年分の取引データには
          依存しない。
        </p>
      </header>

      <SocialInsuranceDeductionForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        社会保険料控除は生命保険料控除・医療費控除と異なり足切りや速算表が無く、
        支払った金額の全額がそのまま所得税・住民税共通の控除額になる。国民年金保険料は
        日本年金機構から送付される「社会保険料(国民年金保険料)控除証明書」、国民年金基金は
        各基金発行の証明書、国民健康保険料・介護保険料は市区町村発行の納付証明書等で
        金額を確認すること。給与から天引きされ勤務先の年末調整で控除済みの分は、通常
        この試算に含める必要は無い。ここで求めた控除額は、他の試算画面の所得金額等には
        自動反映されないため、該当の入力欄から別途差し引くこと。
      </p>
    </div>
  );
}
