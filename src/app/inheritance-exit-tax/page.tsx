import Link from "next/link";
import { InheritanceExitTaxForm } from "./InheritanceExitTaxForm";

export default function InheritanceExitTaxPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          国外転出(相続)時課税制度の試算
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          相続開始の時に国内に居住していた被相続人の対象資産(株式・投資信託等の
          有価証券)の全部又は一部を、相続又は遺贈(限定承認に係るものを除く)により
          非居住者である相続人・受遺者が取得した場合、相続開始の時に被相続人が
          有していた対象資産の価額の合計額が1億円以上であり、かつ被相続人が相続
          開始の日前10年以内に国内に住所又は居所を有していた期間の合計が5年を
          超えるときは、実際には売却していなくても非居住者が取得した部分を時価で
          譲渡したものとみなして被相続人に含み益への譲渡所得税が課税される制度
          (所得税法60条の3第2項、国税庁タックスアンサーNo.1468)。国外転出
          (贈与)時課税(機能106)の姉妹規定で、資産基準(1億円)の判定は被相続人の
          保有資産&ldquo;全体&rdquo;で行う一方、実際に課税対象となるのは非居住者が
          取得した部分の含み益のみという点が同じ構造になる。銘柄ごとに保有数量・
          取得費・相続開始時点の時価と、非居住者が取得した部分かどうかを入力すると、
          適用対象者の要件を満たすかどうかと、みなし譲渡益にかかる税額(申告分離
          課税20.315%)を試算する。
        </p>
      </header>

      <InheritanceExitTaxForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        対象資産は株式・投資信託等の有価証券のみを試算する(匿名組合契約の出資持分・
        未決済の信用取引及び発行日取引・未決済のデリバティブ取引は本ツールが残高を
        管理していないため対象外)。限定承認に係る相続かどうかの判定、外交官等の
        除外規定、納税猶予制度、帰国等による課税取消し、実際の譲渡価額が下落した
        場合の更正の請求による減額特例は、いずれも金額計算の対象外(試算結果の
        注記を参照)。この課税は被相続人に対するもので、被相続人の死亡日までの
        所得として相続人が代わって提出する準確定申告(相続の開始があったことを
        知った日の翌日から4か月以内。相続人が2人以上の場合は原則連署)で申告する
        必要があるが、譲渡所得等の金額の計算方法自体は通常の確定申告と同じ。この
        試算結果を直接DBへ登録する機能は持たない(
        <Link href="/exit-tax" className="underline">
          /exit-tax
        </Link>
        ・
        <Link href="/gift-exit-tax" className="underline">
          /gift-exit-tax
        </Link>
        と同様の位置付け)。実際の申告では相続開始年の被相続人の他の株式等譲渡損益と
        合算のうえ、
        <Link href="/tax-estimate" className="underline">
          /tax-estimate
        </Link>
        へ手入力で反映すること。
      </p>
    </div>
  );
}
