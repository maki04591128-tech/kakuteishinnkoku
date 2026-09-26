import Link from "next/link";
import { NftLossDeductionForm } from "./NftLossDeductionForm";

export default function NftLossDeductionPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          NFTが消失した場合の雑損控除・必要経費を試算する
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          第三者の不正アクセス等により購入したNFTが消失した場合の所得税の取扱いを、
          国税庁「NFTに関する税務上の取扱いについて(FAQ)」問5に基づき試算できる。
          生活に通常必要でない資産・事業用資産等に該当せず盗難等による消失の場合は
          雑損控除の対象、事業用資産等に該当する場合は必要経費算入の対象となる。
        </p>
      </header>

      <NftLossDeductionForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは他の所得区分の試算画面(
        <Link href="/nft-creator-income" className="underline">
          /nft-creator-income
        </Link>
        ・
        <Link href="/blockchain-game-income" className="underline">
          /blockchain-game-income
        </Link>
        ・
        <Link href="/token-service-income" className="underline">
          /token-service-income
        </Link>
        )と同様、この試算結果を直接DBへ登録する機能は持たない。雑損控除の対象となる
        場合は、算出した損失額を
        <Link href="/casualty-loss-deduction" className="underline">
          /casualty-loss-deduction
        </Link>
        の損害金額に入力し、控除額そのもの(総所得金額等による足切り等)を試算すること。
        必要経費算入の対象となる場合は、算出した金額を事業所得又は雑所得の必要経費に
        合算すること。生活に通常必要でない資産・事業用資産等への該当性は自身で確認する
        こと。国内非居住者の取扱い(FAQ問3)・NFTの贈与又は相続による取得(FAQ問9)は
        引き続き今後の課題。
      </p>
    </div>
  );
}
