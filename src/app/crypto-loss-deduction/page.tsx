import Link from "next/link";
import { CryptoLossDeductionForm } from "./CryptoLossDeductionForm";

export default function CryptoLossDeductionPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          暗号資産が盗難・詐欺により消失した場合の雑損控除・必要経費を試算する
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          第三者による盗難・横領や投資詐欺等により暗号資産が消失した場合の所得税の
          取扱いを、所得税法72条(雑損控除)・51条4項(資産損失の必要経費算入)・
          令和4年4月19日の参議院財政金融委員会における国税庁次長答弁に基づき試算
          できる。盗難・横領による消失は雑損控除の対象、詐欺・恐喝による消失は
          雑損控除の対象外だが雑所得の必要経費算入の対象、事業用資産等に該当する
          場合は原因を問わず必要経費算入の対象となる。
        </p>
      </header>

      <CryptoLossDeductionForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは
        <Link href="/nft-loss-deduction" className="underline">
          /nft-loss-deduction
        </Link>
        と同様、この試算結果を直接DBへ登録する機能は持たない。雑損控除の対象と
        なる場合は、算出した損失額を
        <Link href="/casualty-loss-deduction" className="underline">
          /casualty-loss-deduction
        </Link>
        の損害金額に入力し、控除額そのもの(総所得金額等による足切り等)を試算
        すること。必要経費算入の対象となる場合は、算出した金額を暗号資産の
        雑所得の必要経費に合算すること。生活に通常必要でない資産・事業用資産等
        への該当性、消失原因(盗難・横領・詐欺・恐喝のいずれか)は自身で確認する
        こと。単なる秘密鍵の紛失等、原因が特定できない消失は引き続き今後の課題。
      </p>
    </div>
  );
}
