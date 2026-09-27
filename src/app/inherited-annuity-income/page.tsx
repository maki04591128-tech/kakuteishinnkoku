import Link from "next/link";
import { InheritedAnnuityIncomeForm } from "./InheritedAnnuityIncomeForm";

export default function InheritedAnnuityIncomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          相続等により取得した年金受給権に係る雑所得の試算
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          死亡保険金を年金形式で受給している場合等、保険料負担者と年金受取人が異なる個人年金
          保険の年金受給権を相続、遺贈又は贈与により取得した場合、その受給権は相続税・贈与税の
          課税対象になっているため、年金の収入金額を非課税部分と課税部分に振り分けたうえで
          課税部分のみを雑所得として計算する(最高裁平成22年7月6日判決、所得税法35条・
          所得税法施行令185条2項、国税庁タックスアンサーNo.1620)。相続税評価割合が100分の50を
          超える確定年金のみに対応し、終身年金・有期年金・相続税評価割合が100分の50以下の
          場合は対象外(税務署にご確認ください)。保険料負担者=年金受取人である通常の個人年金
          保険の雑所得は
          <Link href="/private-annuity-income" className="underline">
            /private-annuity-income
          </Link>
          で試算すること。
        </p>
      </header>

      <InheritedAnnuityIncomeForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは他の所得控除試算画面と異なり、この試算結果を直接DBへ登録する機能は持たない
        (所得控除ではなく所得区分そのものの計算のため)。この画面で求めた「雑所得の金額の合計」は、
        他の総合課税所得と合算した後の金額として
        <Link href="/tax-estimate" className="underline">
          /tax-estimate
        </Link>
        へ手入力で反映すること。残存期間年数(支払開始日における残りの支払年数)・相続税評価額は、
        生命保険会社が発行する年金支払通知書等に記載された金額をそのまま入力すること。
      </p>
    </div>
  );
}
