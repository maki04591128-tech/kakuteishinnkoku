import Link from "next/link";
import { NftCreatorIncomeForm } from "./NftCreatorIncomeForm";

export default function NftCreatorIncomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          NFT一次流通(組成・発行)による雑所得の試算
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          デジタルアート等を制作し、それに紐づけたNFTをマーケットプレイス等で
          有償で第三者に譲渡した場合(いわゆる一次流通)の雑所得の金額を、国税庁
          「NFTに関する税務上の取扱いについて(FAQ)」問1に基づき試算できる。
          NFTの組成(ミント)費用・販売手数料は必要経費に算入できるが、デジタル
          アートそのものの制作費は必要経費に算入できない点に注意(参考情報として
          別欄に入力できる)。暗号資産・投資の集計とは独立した単体の試算画面のため、
          特定の年分の取引データには依存しない。
        </p>
      </header>

      <NftCreatorIncomeForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは他の所得控除試算画面と異なり、この試算結果を直接DBへ登録する機能は
        持たない(雑所得は所得控除ではなく所得区分そのものの計算であり、
        <code className="mx-1">IncomeDeduction</code>
        のような控除額の登録とは性質が異なるため。一時所得(
        <Link href="/occasional-income" className="underline">
          /occasional-income
        </Link>
        )・公的年金等に係る雑所得(
        <Link href="/public-pension-income" className="underline">
          /public-pension-income
        </Link>
        )と同様の位置付け)。既に取得したNFTを転売する場合(二次流通)は譲渡所得に
        区分されるため、
        <Link href="/general-transfer-income" className="underline">
          /general-transfer-income
        </Link>
        (総合課税の譲渡所得)で試算すること。この画面で求めた雑所得の金額は、
        暗号資産等の他の雑所得と合算し、赤字の場合は0円を下限とした上で
        <Link href="/tax-estimate" className="underline">
          /tax-estimate
        </Link>
        の「給与所得等の課税所得金額」へ手入力で反映すること。
      </p>
    </div>
  );
}
