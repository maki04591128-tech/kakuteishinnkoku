import Link from "next/link";
import { listTaxYears } from "@/lib/taxYear";
import { SmallBusinessMutualAidDeductionForm } from "./SmallBusinessMutualAidDeductionForm";

export default async function SmallBusinessMutualAidDeductionPage({
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
          小規模企業共済等掛金控除額の試算({year}年分)
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          iDeCo(個人型確定拠出年金)・小規模企業共済・心身障害者扶養共済の年間掛金額を
          入力すると、その合計額(全額控除、上限なし)を試算できる。iDeCoは加入区分ごとに
          年間拠出限度額が法令で定められているため、参考として選択した区分の限度額との
          比較も表示する。暗号資産・投資の集計とは独立した単体の試算画面のため、
          この年分の取引データには依存しない。
        </p>
      </header>

      <SmallBusinessMutualAidDeductionForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        小規模企業共済等掛金控除は生命保険料控除・医療費控除と異なり足切りや速算表が無く、
        支払った掛金の全額がそのまま所得税・住民税共通の控除額になる。iDeCoの掛金は
        運営管理機関から送付される年間の払込証明書(またはねんきん定期便に準じた通知)の
        金額で確認すること。ここで求めた控除額は、他の試算画面の所得金額等には
        自動反映されないため、該当の入力欄から別途差し引くこと。
      </p>
    </div>
  );
}
