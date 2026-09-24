import Link from "next/link";
import { PublicPensionIncomeForm } from "./PublicPensionIncomeForm";

export default function PublicPensionIncomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">公的年金等に係る雑所得の試算</h1>
        <p className="mt-1 text-sm text-neutral-500">
          公的年金等(国民年金・厚生年金・企業年金等)の収入金額と年齢区分を入力すると、
          国税庁の速算表(タックスアンサーNo.1600)に基づき公的年金等控除額・雑所得の金額を
          試算できる。暗号資産・投資の集計とは独立した単体の試算画面のため、特定の年分の
          取引データには依存しない(速算表自体も令和2年分(2020年分)以後、税制改正による
          変更が無く継続している)。
        </p>
      </header>

      <PublicPensionIncomeForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは他の所得控除試算画面と異なり、この試算結果を直接DBへ登録する機能は
        持たない(公的年金等控除は所得控除ではなく「雑所得の金額」そのものの計算であり、
        `IncomeDeduction`のような控除額の登録とは性質が異なるため)。この画面で求めた
        「公的年金等に係る雑所得の金額」は、所得金額調整控除②(
        <Link href="/income-amount-adjustment-deduction" className="underline">
          /income-amount-adjustment-deduction
        </Link>
        )の入力欄と、
        <Link href="/tax-estimate" className="underline">
          /tax-estimate
        </Link>
        の「給与所得等の課税所得金額」(他の総合課税所得・所得控除と合算した後の金額)へ
        手入力で反映すること。
      </p>
    </div>
  );
}
