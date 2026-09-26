import Link from "next/link";
import { LowUtilizationLandSaleDeductionForm } from "./LowUtilizationLandSaleDeductionForm";

export default function LowUtilizationLandSaleDeductionPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          低未利用土地等を売った場合の税額試算
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          譲渡価額・取得費・譲渡費用・所有期間を入力すると、低未利用土地等を譲渡した場合の
          長期譲渡所得の100万円特別控除(措置法35条の3、国税庁タックスアンサーNo.3223)を
          適用した譲渡所得の税額(申告分離課税)を試算できる。特定土地区画整理事業等の
          2,000万円特別控除(措置法34条。
          <Link href="/land-readjustment-sale-deduction" className="underline">
            /land-readjustment-sale-deduction
          </Link>
          )等と同じ「譲渡所得の特別控除の種類」の系統の最後の1類型で、公共事業等のための
          買取りではなく譲渡した土地等自体が「低未利用土地等」であることを要件とする。
          この特例は所有期間5年超の長期譲渡所得のみが対象(短期譲渡所得には適用不可)で、
          譲渡価額(建物等の対価を含む)が500万円以下(市街化区域等の特例区域内であれば
          800万円以下)であることも要件になるため、区域の該当有無を入力すると上限を
          自動判定する。取得費が不明、または譲渡価額の5%相当額を下回る場合は、
          概算取得費の特例(措置法31条の4、国税庁タックスアンサーNo.3258)により
          譲渡価額の5%相当額を取得費とすることを選択できる。
        </p>
      </header>

      <LowUtilizationLandSaleDeductionForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは、譲渡価額の上限(500万円/800万円)以外の適用要件(特別の関係がある者への
        譲渡でないこと、都市計画区域内にあり譲渡後に利用されること、分筆履歴、他の特別控除
        との重複適用でないこと等)の判定は行わない(specialDeductionEligibleとしてユーザー
        自身が確認する)。同一年中に複数の低未利用土地等を譲渡する場合の価額合算判定・
        収用等の5,000万円特別控除等、他の土地建物の特別控除と同一年に重複して適用する
        場合の年間合計5,000万円限度額(措法36)の調整も対象外。実際の申告内容は国税庁
        タックスアンサーNo.3223や税理士等の専門家に確認すること。
      </p>
    </div>
  );
}
