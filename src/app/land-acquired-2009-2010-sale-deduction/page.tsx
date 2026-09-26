import Link from "next/link";
import { LandAcquired2009To2010SaleDeductionForm } from "./LandAcquired2009To2010SaleDeductionForm";

export default function LandAcquired2009To2010SaleDeductionPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          平成21年及び22年に取得した土地等を売った場合の税額試算
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          譲渡価額・取得費・譲渡費用・所有期間を入力すると、平成21年(2009年)1月1日から
          平成22年(2010年)12月31日までの間に取得した国内にある土地等を、取得した年の
          1月1日から引き続き所有期間が5年を超える年に譲渡した場合の1,000万円特別控除
          (措置法35条の2、国税庁タックスアンサーNo.3225)を適用した譲渡所得の税額
          (申告分離課税)を試算できる。特定土地区画整理事業等のための2,000万円特別控除
          (措置法34条。
          <Link href="/land-readjustment-sale-deduction" className="underline">
            /land-readjustment-sale-deduction
          </Link>
          )・特定住宅地造成事業等のための1,500万円特別控除(措置法34条の2。
          <Link href="/housing-land-development-sale-deduction" className="underline">
            /housing-land-development-sale-deduction
          </Link>
          )と同じ「譲渡所得の特別控除の種類」の系統だが、公共事業等のための買取りではなく
          取得時期そのものを要件とするため、必然的に長期譲渡所得(所有期間5年超)のみが
          対象になる(短期譲渡所得には適用できない)。取得費が不明、または譲渡価額の5%
          相当額を下回る場合は、概算取得費の特例(措置法31条の4、国税庁タックスアンサー
          No.3258)により譲渡価額の5%相当額を取得費とすることを選択できる。
        </p>
      </header>

      <LandAcquired2009To2010SaleDeductionForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは、取得時期(平成21年1月1日〜平成22年12月31日)・取得原因(特別な関係が
        ある者からの取得や相続・贈与等による取得でないこと)等の適用要件の判定は行わない
        (specialDeductionEligibleとしてユーザー自身が確認する)。控除限度額(1,000万円)は
        その年に譲渡した対象土地等の譲渡益の合計に対する年単位の上限のため、複数筆を
        まとめて譲渡する場合は按分後の金額を入力すること。収用等の5,000万円特別控除・
        居住用財産の3,000万円特別控除・特定土地区画整理事業等の2,000万円特別控除・
        特定住宅地造成事業等の1,500万円特別控除等、他の土地建物の特別控除と同一年に
        重複して適用する場合の年間合計5,000万円限度額(措法36)の調整も対象外。実際の
        申告内容は国税庁タックスアンサーNo.3225や税理士等の専門家に確認すること。
      </p>
    </div>
  );
}
