import Link from "next/link";
import { CryptoExchangeCompensationIncomeForm } from "./CryptoExchangeCompensationIncomeForm";

export default function CryptoExchangeCompensationIncomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          暗号資産交換業者から金銭の補償を受けた場合の雑所得を試算する
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          暗号資産交換業者の不正流出・破綻等により預けていた暗号資産を返還できなく
          なり、これに代えて金銭の補償を受けた場合の所得税の取扱いを、国税庁
          タックスアンサーNo.1525に基づき試算できる。補償金は非課税の損害賠償金には
          該当せず、返還できなくなった暗号資産を補償金額で売却したのと同じ結果として
          総合課税の雑所得の対象となる。補償金額が取得費を下回る場合は損失となり、
          他の雑所得と通算できる。
        </p>
      </header>

      <CryptoExchangeCompensationIncomeForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールはこの試算結果を直接DBへ登録する機能は持たない。算出した雑所得の
        金額(マイナスの場合は損失)を、暗号資産の他の雑所得(現物取引・証拠金取引等)と
        合算してダッシュボード・下書きCSVに反映すること。補償を一切受けられず
        消失した部分がある場合は、その部分について
        <Link href="/crypto-loss-deduction" className="underline">
          /crypto-loss-deduction
        </Link>
        (暗号資産が盗難・詐欺により消失した場合の雑損控除・必要経費算入の試算)を
        別途行うこと。
      </p>
    </div>
  );
}
