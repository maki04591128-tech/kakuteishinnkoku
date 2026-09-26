import Link from "next/link";
import { TokenServiceIncomeForm } from "./TokenServiceIncomeForm";

export default function TokenServiceIncomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          役務提供の対価として取得したトークンの所得を試算する
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          役務提供の対価として取引先の法人が発行するトークンを取得した場合の所得を、
          国税庁「NFTに関する税務上の取扱いについて(FAQ)」問6に基づき試算できる。
          契約の類型により所得区分が異なり、請負契約その他これに類する契約の場合は
          事業所得又は雑所得(本ツールは雑所得として試算)、雇用契約その他これに類する
          契約の場合は給与所得に区分される。トークンの時価の算定が困難な場合は、
          契約などによって定められた対価の額を時価として扱ってよい。
        </p>
      </header>

      <TokenServiceIncomeForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは他の所得区分の試算画面(
        <Link href="/nft-creator-income" className="underline">
          /nft-creator-income
        </Link>
        ・
        <Link href="/blockchain-game-income" className="underline">
          /blockchain-game-income
        </Link>
        )と同様、この試算結果を直接DBへ登録する機能は持たない。雇用契約等(給与所得)分の
        対価の額の合計は、通常の給与収入額とは別枠の追加分として
        <Link href="/employment-income" className="underline">
          /employment-income
        </Link>
        の給与収入金額に合算して入力し、給与所得金額を再計算すること。請負契約等
        (事業所得又は雑所得)分は、暗号資産等の他の雑所得と合算し、赤字の場合は0円を
        下限とした上で
        <Link href="/tax-estimate" className="underline">
          /tax-estimate
        </Link>
        の「給与所得等の課税所得金額」へ手入力で反映すること。商品の購入の際に
        無償でトークンを取得した場合(FAQ問7)は一時所得に区分されるため、
        <Link href="/occasional-income" className="underline">
          /occasional-income
        </Link>
        の総収入金額にトークンの時価を合算して試算すること。
      </p>
    </div>
  );
}
