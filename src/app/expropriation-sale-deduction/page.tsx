import Link from "next/link";
import { ExpropriationSaleDeductionForm } from "./ExpropriationSaleDeductionForm";

export default function ExpropriationSaleDeductionPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          収用等により土地建物を売った場合の税額試算
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          譲渡価額(補償金・買取り代金)・取得費・譲渡費用・所有期間を入力すると、
          収用等に伴い代替資産を取得しない場合の5,000万円特別控除(措置法33条の4、
          国税庁タックスアンサーNo.3552)を適用した譲渡所得の税額(申告分離課税)を
          試算できる。居住用財産の3,000万円特別控除(措置法35条。
          <Link href="/home-sale-deduction" className="underline">
            /home-sale-deduction
          </Link>
          )と異なり、居住用財産に限らず事業用・投資用の土地建物にも適用があり、
          所有期間(短期・長期)を問わず適用できる。取得費が不明、または譲渡価額の
          5%相当額を下回る場合は、概算取得費の特例(措置法31条の4、国税庁タックス
          アンサーNo.3258)により譲渡価額の5%相当額を取得費とすることを選択できる。
        </p>
      </header>

      <ExpropriationSaleDeductionForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは、代替資産による課税繰延べの特例(措置法33条・33条の2)との
        選択適用・公共事業施行者から最初に買取り等の申し出を受けた日から6か月
        以内の譲渡であること・その申し出を受けた者本人(相続人を含む)による
        譲渡であること等の適用要件の判定は行わない(specialDeductionEligibleとして
        ユーザー自身が確認する)。居住用財産の3,000万円特別控除等、他の土地建物の
        特別控除と同一年に重複して適用する場合の年間合計限度額の調整も対象外。
        実際の申告内容は国税庁タックスアンサーNo.3552や税理士等の専門家に
        確認すること。
      </p>
    </div>
  );
}
