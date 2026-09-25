import Link from "next/link";
import { OccasionalIncomeForm } from "./OccasionalIncomeForm";

export default function OccasionalIncomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">一時所得の試算</h1>
        <p className="mt-1 text-sm text-neutral-500">
          生命保険の満期返戻金・解約返戻金、懸賞金・賞金、競馬等の払戻金等の
          総収入金額とその収入を得るために直接要した支出額を入力すると、
          国税庁タックスアンサーNo.1490「一時所得」に基づき一時所得の金額
          (特別控除額最高50万円を控除後)と、総所得金額に算入する額(2分の1
          課税後)を試算できる。暗号資産・投資の集計とは独立した単体の試算画面のため、
          特定の年分の取引データには依存しない。
        </p>
      </header>

      <OccasionalIncomeForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは他の所得控除試算画面と異なり、この試算結果を直接DBへ登録する機能は
        持たない(一時所得は所得控除ではなく所得区分そのものの計算であり、
        `IncomeDeduction`のような控除額の登録とは性質が異なるため。公的年金等に
        係る雑所得(
        <Link href="/public-pension-income" className="underline">
          /public-pension-income
        </Link>
        )と同様の位置付け)。この画面で求めた「総所得金額に算入する額」は、他の
        総合課税所得と合算した後の金額として
        <Link href="/tax-estimate" className="underline">
          /tax-estimate
        </Link>
        の「給与所得等の課税所得金額」へ手入力で反映すること。
      </p>
    </div>
  );
}
