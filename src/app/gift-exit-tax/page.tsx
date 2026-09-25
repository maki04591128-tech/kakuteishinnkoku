import Link from "next/link";
import { GiftExitTaxForm } from "./GiftExitTaxForm";

export default function GiftExitTaxPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          国外転出(贈与)時課税制度の試算
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          国内に居住したままの贈与者が、対象資産(株式・投資信託等の有価証券)の
          全部又は一部を国外に居住する者(非居住者)に贈与した場合、贈与の時に
          贈与者が所有等している対象資産の価額の合計額が1億円以上であり、かつ
          贈与の日前10年以内に国内に住所又は居所を有していた期間の合計が5年を
          超えるときは、実際には売却していなくても贈与した部分を時価で譲渡した
          ものとみなして贈与者に含み益への譲渡所得税が課税される制度(所得税法
          60条の3、国税庁タックスアンサーNo.1467)。国外転出時課税(いわゆる
          出国税。機能101)の姉妹規定で、資産基準(1億円)の判定は保有資産
          &ldquo;全体&rdquo;で行う一方、実際に課税対象となるのは贈与した部分の
          含み益のみという点が異なる。銘柄ごとに保有数量・取得費・贈与時点の時価と、
          贈与した部分かどうかを入力すると、適用対象者の要件を満たすかどうかと、
          みなし譲渡益にかかる税額(申告分離課税20.315%)を試算する。
        </p>
      </header>

      <GiftExitTaxForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        対象資産は株式・投資信託等の有価証券のみを試算する(匿名組合契約の出資持分・
        未決済の信用取引及び発行日取引・未決済のデリバティブ取引は本ツールが残高を
        管理していないため対象外)。納税猶予制度・帰国等による課税取消し・実際の
        譲渡価額が下落した場合の更正の請求による減額特例、および相続又は遺贈により
        非居住者に資産が移転した場合の特例(国外転出(相続)時課税。国税庁タックス
        アンサーNo.1468)は、いずれも金額計算の対象外(試算結果の注記を参照)。
        この試算結果を直接DBへ登録する機能は持たない(
        <Link href="/exit-tax" className="underline">
          /exit-tax
        </Link>
        ・
        <Link href="/general-transfer-income" className="underline">
          /general-transfer-income
        </Link>
        と同様の位置付け)。実際の申告では贈与を行った年の他の株式等譲渡損益と
        合算のうえ、
        <Link href="/tax-estimate" className="underline">
          /tax-estimate
        </Link>
        へ手入力で反映すること。
      </p>
    </div>
  );
}
