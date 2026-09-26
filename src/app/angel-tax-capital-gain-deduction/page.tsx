import Link from "next/link";
import { AngelTaxCapitalGainDeductionForm } from "./AngelTaxCapitalGainDeductionForm";

export default function AngelTaxCapitalGainDeductionPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          エンジェル税制(譲渡益控除方式)の試算
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          特定中小会社の株式(特定株式)・設立特定株式(起業特例)を払込みにより取得した
          場合、その取得価額をその年の株式等に係る譲渡所得等の金額から控除できる特例
          (措置法37条の13・37条の13の2、実務上「優遇措置B」、国税庁タックスアンサー
          No.1530)。取得価額を寄附金控除に加算する優遇措置A(措置法37条の13の3)は
          <Link href="/donation-deduction" className="underline">
            /donation-deduction
          </Link>
          で試算できる。銘柄ごとに取得数量・取得価額・年中に譲渡した数量を入力すると、
          年末時点で保有する部分の取得価額のみを控除対象額として計算し、一般株式等→
          上場株式等の順にその年の譲渡所得等の金額から控除する。
        </p>
      </header>

      <AngelTaxCapitalGainDeductionForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        控除対象額が譲渡所得等の金額を上回っても繰越はされないが、特定株式・設立特定
        株式自体の取得価額が減額されるわけではないため将来の譲渡時の取得費には影響し
        ない。適用を受けた金額が20億円を超える場合の翌年以後の取得価額調整計算・特定
        投資株式が価値を失った場合の特例(No.1531)・譲渡損失の損益通算及び繰越控除の
        特例(No.1532・No.1533)は対象外(試算結果の注記を参照)。この試算結果を直接
        DBへ登録する機能は持たない(
        <Link href="/exit-tax" className="underline">
          /exit-tax
        </Link>
        ・
        <Link href="/general-transfer-income" className="underline">
          /general-transfer-income
        </Link>
        と同様の位置付け)。実際の申告では対象年の一般株式等・上場株式等の譲渡所得等の
        金額からこの控除額を差し引いたうえで、
        <Link href="/tax-estimate" className="underline">
          /tax-estimate
        </Link>
        へ手入力で反映すること。
      </p>
    </div>
  );
}
