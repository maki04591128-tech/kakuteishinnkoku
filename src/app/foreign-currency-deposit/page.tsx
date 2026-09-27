import Link from "next/link";
import { ForeignCurrencyDepositForm } from "./ForeignCurrencyDepositForm";

export default function ForeignCurrencyDepositPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">外貨預金の為替差損益(雑所得)の試算</h1>
        <p className="mt-1 text-sm text-neutral-500">
          外貨預金を円に払い戻した場合や、外貨預金を元手に他の資産を購入した場合に生じる
          為替差損益(所得税法57条の3第1項、その他の雑所得・総合課税)を試算できる。通貨ごとに
          預入(取得)・払出のイベントを数量と円換算レートで入力すると、複数回の預入がある
          場合の平均取得レート(所得税法施行令118条1項の規定に準ずる総平均法)を自動計算し、
          払出額との差額を為替差損益として合算する。暗号資産・投資の集計とは独立した
          単体の試算画面のため、特定の年分の取引データには依存しない。
        </p>
      </header>

      <ForeignCurrencyDepositForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは他の所得控除試算画面と異なり、この試算結果を直接DBへ登録する機能は
        持たない(外貨預金の為替差損益は所得控除ではなく所得区分そのものの計算であり、
        `IncomeDeduction`のような控除額の登録とは性質が異なるため。一時所得(
        <Link href="/occasional-income" className="underline">
          /occasional-income
        </Link>
        )・総合課税の譲渡所得(
        <Link href="/general-transfer-income" className="underline">
          /general-transfer-income
        </Link>
        )と同様の位置付け)。この画面で求めた「為替差損益の合計」は、他の総合課税所得と
        合算した後の金額として
        <Link href="/tax-estimate" className="underline">
          /tax-estimate
        </Link>
        の「給与所得等の課税所得金額」へ手入力で反映すること。同一の外国通貨のまま他の
        金融機関の預金口座へ預け替えるだけの場合(外貨の保有状態に実質的な変化が無い場合)は
        為替差損益を認識しないため(所得税法施行令167条の6第2項)、そのような預け替えは
        「払出」として入力しないこと。
      </p>
    </div>
  );
}
