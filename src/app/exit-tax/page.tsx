import Link from "next/link";
import { ExitTaxForm } from "./ExitTaxForm";

export default function ExitTaxPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          国外転出時課税制度(出国税)の試算
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          国外転出(海外移住等により日本国内に住所・居所を有しないこととなること)をする
          一定の居住者が、対象資産(株式・投資信託等の有価証券)の価額の合計額1億円以上を
          保有している場合、実際に売却していなくても転出時の時価で譲渡したものとみなして
          含み益に譲渡所得税が課税される制度(所得税法60条の2、国税庁タックスアンサー
          No.1478)。銘柄ごとに保有数量・取得費・判定日時点の時価を入力すると、適用対象者の
          要件(資産基準1億円以上・国内居住期間5年超)を満たすかどうかと、みなし譲渡益に
          かかる税額(申告分離課税20.315%)を試算する。暗号資産・投資の年間集計とは
          独立した単体の試算画面のため、特定の年分の取引データには依存しない。
        </p>
      </header>

      <ExitTaxForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        対象資産は株式・投資信託等の有価証券のみを試算する(匿名組合契約の出資持分・
        未決済の信用取引及び発行日取引・未決済のデリバティブ取引は本ツールが残高を
        管理していないため対象外)。納税猶予制度・5年以内に帰国した場合の課税取消し・
        実際の譲渡価額が下落した場合の更正の請求による減額特例は、いずれも金額計算の
        対象外(試算結果の注記を参照)。この試算結果を直接DBへ登録する機能は持たない
        (
        <Link href="/general-transfer-income" className="underline">
          /general-transfer-income
        </Link>
        ・
        <Link href="/occasional-income" className="underline">
          /occasional-income
        </Link>
        と同様の位置付け)。実際の申告では国外転出年の他の株式等譲渡損益と合算のうえ、
        <Link href="/tax-estimate" className="underline">
          /tax-estimate
        </Link>
        へ手入力で反映すること。
      </p>
    </div>
  );
}
