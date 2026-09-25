import Link from "next/link";
import { GeneralTransferIncomeForm } from "./GeneralTransferIncomeForm";

export default function GeneralTransferIncomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">総合課税の譲渡所得の試算</h1>
        <p className="mt-1 text-sm text-neutral-500">
          自動車、ゴルフ会員権、貴金属・宝石・書画骨とう(1個又は1組30万円超)、金地金、
          特許権等、土地・建物・株式等以外の資産を譲渡した場合の譲渡所得(所得税法33条、
          国税庁タックスアンサーNo.1460・No.3105・No.3152)を試算できる。資産ごとに譲渡価額・
          取得費・譲渡費用・所有期間(年)を入力すると、短期(所有期間5年以下)・長期(5年超)に
          自動区分し、特別控除額(最高50万円・短期優先充当)と、総所得金額に算入する額
          (長期分は2分の1)を計算する。暗号資産・投資の集計とは独立した単体の試算画面のため、
          特定の年分の取引データには依存しない。
        </p>
      </header>

      <GeneralTransferIncomeForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは他の所得控除試算画面と異なり、この試算結果を直接DBへ登録する機能は
        持たない(総合課税の譲渡所得は所得控除ではなく所得区分そのものの計算であり、
        `IncomeDeduction`のような控除額の登録とは性質が異なるため。一時所得(
        <Link href="/occasional-income" className="underline">
          /occasional-income
        </Link>
        )・公的年金等に係る雑所得(
        <Link href="/public-pension-income" className="underline">
          /public-pension-income
        </Link>
        )と同様の位置付け)。この画面で求めた「総所得金額に算入する額」は、他の
        総合課税所得と合算した後の金額として
        <Link href="/tax-estimate" className="underline">
          /tax-estimate
        </Link>
        の「給与所得等の課税所得金額」へ手入力で反映すること。土地・建物・株式等の
        譲渡はそれぞれ別画面(住宅の譲渡関連は
        <Link href="/home-sale-deduction" className="underline">
          /home-sale-deduction
        </Link>
        等、株式等は
        <Link href="/dividend-simulation" className="underline">
          /dividend-simulation
        </Link>
        等)で試算すること。
      </p>
    </div>
  );
}
