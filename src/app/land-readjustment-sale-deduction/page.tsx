import Link from "next/link";
import { LandReadjustmentSaleDeductionForm } from "./LandReadjustmentSaleDeductionForm";

export default function LandReadjustmentSaleDeductionPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          特定土地区画整理事業等のために土地等を売った場合の税額試算
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          譲渡価額(買取り代金)・取得費・譲渡費用・所有期間を入力すると、土地区画整理
          事業・住宅街区整備事業・第一種市街地再開発事業・防災街区整備事業等のために
          土地等が買い取られた場合の2,000万円特別控除(措置法34条、国税庁タックス
          アンサーNo.3223)を適用した譲渡所得の税額(申告分離課税)を試算できる。
          収用等により土地建物を売った場合の5,000万円特別控除(措置法33条の4。
          <Link href="/expropriation-sale-deduction" className="underline">
            /expropriation-sale-deduction
          </Link>
          )と同じ「公共事業等のために土地等を売った場合の特別控除」の系統だが、対象と
          なる事業の種類・控除額(2,000万円)が異なる。取得費が不明、または譲渡価額の
          5%相当額を下回る場合は、概算取得費の特例(措置法31条の4、国税庁タックス
          アンサーNo.3258)により譲渡価額の5%相当額を取得費とすることを選択できる。
        </p>
      </header>

      <LandReadjustmentSaleDeductionForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは、事業主体・買取りの種類(土地区画整理事業・市街地再開発事業・文化財
        保護法等)、同一事業の買取りが2以上の年にわたる場合は最初の年の買取りである
        こと等の適用要件の判定は行わない(specialDeductionEligibleとしてユーザー自身が
        確認する)。収用等の5,000万円特別控除・居住用財産の3,000万円特別控除等、他の
        土地建物の特別控除と同一年に重複して適用する場合の年間合計5,000万円限度額
        (措法36)の調整も対象外。実際の申告内容は国税庁タックスアンサーNo.3223や
        税理士等の専門家に確認すること。
      </p>
    </div>
  );
}
