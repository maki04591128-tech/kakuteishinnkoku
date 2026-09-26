import Link from "next/link";
import { AgriculturalLandRationalizationSaleDeductionForm } from "./AgriculturalLandRationalizationSaleDeductionForm";

export default function AgriculturalLandRationalizationSaleDeductionPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          農地保有の合理化等のために農地等を売った場合の税額試算
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          譲渡価額・取得費・譲渡費用・所有期間を入力すると、農地保有の合理化等のために
          農地等を譲渡した場合の800万円特別控除(措置法34条の3、国税庁タックスアンサー
          No.3223)を適用した譲渡所得の税額(申告分離課税)を試算できる。特定土地区画
          整理事業等のための2,000万円特別控除(措置法34条。
          <Link href="/land-readjustment-sale-deduction" className="underline">
            /land-readjustment-sale-deduction
          </Link>
          )・特定住宅地造成事業等のための1,500万円特別控除(措置法34条の2。
          <Link href="/housing-land-development-sale-deduction" className="underline">
            /housing-land-development-sale-deduction
          </Link>
          )と同じ「譲渡所得の特別控除の種類」の系統だが、公共事業等のための買取りではなく
          農地保有・林地保有の合理化に資する譲渡(あっせん・農地中間管理機構への譲渡・
          清算金の取得等)であることを要件とする。農地中間管理機構への買入協議による譲渡
          (1,500万円)・地域農業経営基盤強化促進計画の特例による譲渡(2,000万円)は、
          より高額な措置法34条・34条の2側の対象であり本特例(800万円)の対象からは除かれる。
          所有期間を問わず適用でき、取得費が不明、または譲渡価額の5%相当額を下回る場合は、
          概算取得費の特例(措置法31条の4、国税庁タックスアンサーNo.3258)により譲渡価額の
          5%相当額を取得費とすることを選択できる。
        </p>
      </header>

      <AgriculturalLandRationalizationSaleDeductionForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは、対象となる譲渡の類型(あっせん・農地中間管理機構への譲渡・清算金の
        取得等)・確定申告書への記載及び証明書類の添付等の適用要件の判定は行わない
        (specialDeductionEligibleとしてユーザー自身が確認する)。収用等の5,000万円
        特別控除・居住用財産の3,000万円特別控除・特定土地区画整理事業等の2,000万円
        特別控除・特定住宅地造成事業等の1,500万円特別控除等、他の土地建物の特別控除と
        同一年に重複して適用する場合の年間合計5,000万円限度額(措法36)の調整も対象外。
        実際の申告内容は国税庁タックスアンサーNo.3223や税理士等の専門家に確認すること。
      </p>
    </div>
  );
}
