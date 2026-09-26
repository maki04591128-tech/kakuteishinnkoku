import Link from "next/link";
import { HousingLandDevelopmentSaleDeductionForm } from "./HousingLandDevelopmentSaleDeductionForm";

export default function HousingLandDevelopmentSaleDeductionPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          特定住宅地造成事業等のために土地等を売った場合の税額試算
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          譲渡価額(買取り代金)・取得費・譲渡費用・所有期間を入力すると、地方公共団体・
          独立行政法人都市再生機構・地方住宅供給公社等が行う住宅建設または宅地造成の
          事業等のために土地等が買い取られた場合の1,500万円特別控除(措置法34条の2、
          国税庁タックスアンサーNo.3223)を適用した譲渡所得の税額(申告分離課税)を
          試算できる。特定土地区画整理事業等のための2,000万円特別控除(措置法34条。
          <Link href="/land-readjustment-sale-deduction" className="underline">
            /land-readjustment-sale-deduction
          </Link>
          )と同じ「公共事業等のために土地等を売った場合の特別控除」の系統だが、対象と
          なる事業の種類・控除額(1,500万円)が異なる。対象となる号のうち、独立行政法人
          都市再生機構等が行う一定規模以上の一団の宅地造成事業(3号)は令和5年12月31日
          までの譲渡に限られる時限措置のため、令和6年(2024年)以後の譲渡には適用できない
          点に注意。取得費が不明、または譲渡価額の5%相当額を下回る場合は、概算取得費の
          特例(措置法31条の4、国税庁タックスアンサーNo.3258)により譲渡価額の5%相当額を
          取得費とすることを選択できる。
        </p>
      </header>

      <HousingLandDevelopmentSaleDeductionForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは、買取りの主体・種類(措置法34条の2第2項各号)、同一事業の買取りが
        2以上の年にわたる場合は最初の年の買取りであること等の適用要件の判定は行わない
        (specialDeductionEligibleとしてユーザー自身が確認する)。収用等の5,000万円
        特別控除・居住用財産の3,000万円特別控除・特定土地区画整理事業等の2,000万円
        特別控除等、他の土地建物の特別控除と同一年に重複して適用する場合の年間合計
        5,000万円限度額(措法36)の調整も対象外。実際の申告内容は国税庁タックスアンサー
        No.3223や税理士等の専門家に確認すること。
      </p>
    </div>
  );
}
