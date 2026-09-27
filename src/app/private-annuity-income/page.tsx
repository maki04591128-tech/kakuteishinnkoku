import Link from "next/link";
import { PrivateAnnuityIncomeForm } from "./PrivateAnnuityIncomeForm";

export default function PrivateAnnuityIncomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          個人年金保険の年金にかかる雑所得の試算
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          保険料負担者と年金受取人が同一人である生命保険会社の個人年金保険を年金形式で
          受け取る場合、公的年金等控除の対象にならず、所得税法35条・所得税法施行令183条
          1項に基づく「公的年金等以外の雑所得」になる(国税庁タックスアンサーNo.1610)。
          必要経費は、その年に支払を受けた年金の額に「保険料総額÷支払総額(又は見込額)」の
          割合を乗じて計算する。公的年金等(国民年金・厚生年金等)は
          <Link href="/public-pension-income" className="underline">
            /public-pension-income
          </Link>
          、一時金として受け取る場合の一時所得は
          <Link href="/occasional-income" className="underline">
            /occasional-income
          </Link>
          で試算すること。
        </p>
      </header>

      <PrivateAnnuityIncomeForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは他の所得控除試算画面と異なり、この試算結果を直接DBへ登録する機能は持たない
        (個人年金保険の雑所得は所得控除ではなく所得区分そのものの計算であり、
        `IncomeDeduction`のような控除額の登録とは性質が異なるため。海外の金融機関の
        預金利子(
        <Link href="/foreign-interest-income" className="underline">
          /foreign-interest-income
        </Link>
        )等と同様の位置付け)。この画面で求めた「雑所得(公的年金等以外)の金額の合計」は、
        他の総合課税所得と合算した後の金額として
        <Link href="/tax-estimate" className="underline">
          /tax-estimate
        </Link>
        へ手入力で反映すること。有期年金・終身年金等、支払開始日において支払総額が確定
        していない年金は、支払総額の見込額(施行令82条の3に準じた計算)そのものは本ツールでは
        算出しないため、生命保険会社が発行する年金支払通知書等に記載された見込額をそのまま
        「年金の支払総額」欄へ入力すること。
      </p>
    </div>
  );
}
