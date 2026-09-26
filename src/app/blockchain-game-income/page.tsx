import Link from "next/link";
import { BlockchainGameIncomeForm } from "./BlockchainGameIncomeForm";

export default function BlockchainGameIncomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          ブロックチェーンゲームの報酬(ゲーム内通貨)に係る雑所得の試算
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          ブロックチェーンゲームの報酬として取得したゲーム内通貨(トークン)の
          雑所得の金額を、国税庁「NFTに関する税務上の取扱いについて(FAQ)」問8に
          基づき試算できる。取得の都度の時価評価は煩雑なため、FAQが認める
          「年末に一括で評価する方法(簡便法)」のみに対応する(算式:
          (年末保有数量-年始保有数量-年中購入数量)×年末の暗号資産への換算レート)。
          暗号資産・投資の集計とは独立した単体の試算画面のため、特定の年分の
          取引データには依存しない。
        </p>
      </header>

      <BlockchainGameIncomeForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは他の所得控除試算画面と異なり、この試算結果を直接DBへ登録する機能は
        持たない(雑所得は所得控除ではなく所得区分そのものの計算であり、
        <code className="mx-1">IncomeDeduction</code>
        のような控除額の登録とは性質が異なるため。一時所得(
        <Link href="/occasional-income" className="underline">
          /occasional-income
        </Link>
        )・NFT一次流通の雑所得(
        <Link href="/nft-creator-income" className="underline">
          /nft-creator-income
        </Link>
        )と同様の位置付け)。取得の都度の時価評価による原則法(簡便法を使わない方法)、
        NFTの贈与・相続による取得(FAQ問9)は本ツールの対象外(今後の課題)。この画面で
        求めた雑所得の金額は、暗号資産等の他の雑所得と合算し、赤字の場合は0円を
        下限とした上で
        <Link href="/tax-estimate" className="underline">
          /tax-estimate
        </Link>
        の「給与所得等の課税所得金額」へ手入力で反映すること。
      </p>
    </div>
  );
}
