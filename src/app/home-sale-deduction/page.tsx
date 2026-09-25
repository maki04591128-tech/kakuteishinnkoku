import Link from "next/link";
import { HomeSaleDeductionForm } from "./HomeSaleDeductionForm";

export default function HomeSaleDeductionPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          居住用財産(マイホーム)を譲渡した場合の税額試算
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          譲渡価額・取得費・譲渡費用・所有期間を入力すると、居住用財産の3,000万円
          特別控除(措置法35条)と、所有期間10年超の場合の軽減税率の特例(措置法31条の3)を
          適用した土地・建物の譲渡所得の税額(申告分離課税)を試算できる。株式等・暗号資産の
          集計とは独立した単体の試算画面のため、特定の年分の取引データには依存しない。
          取得費が不明、または譲渡価額の5%相当額を下回る場合は、概算取得費の特例
          (措置法31条の4、国税庁タックスアンサーNo.3258)により譲渡価額の5%相当額を
          取得費とすることを選択できる。
        </p>
      </header>

      <HomeSaleDeductionForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは3,000万円特別控除・軽減税率の特例それぞれの適用要件(自己の居住用財産で
        あること、配偶者・直系血族等特別の関係がある者への譲渡でないこと、前年・前々年に
        同一の特例の適用を受けていないこと等)の判定は行わない。マイホームの買換え等に伴う
        譲渡損失の損益通算・繰越控除(措置法41条の5等)、収用等に伴う5,000万円特別控除、
        空き家の3,000万円特別控除(措置法35条3項)等、他の特例も対象外。この試算結果を
        <Link href="/tax-estimate" className="underline">
          /tax-estimate
        </Link>
        へ自動反映する機能は持たない。実際の申告内容は税理士等の専門家に確認すること。
      </p>
    </div>
  );
}
