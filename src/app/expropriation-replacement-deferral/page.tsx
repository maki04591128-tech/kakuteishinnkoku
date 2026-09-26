import Link from "next/link";
import { ExpropriationReplacementDeferralForm } from "./ExpropriationReplacementDeferralForm";

export default function ExpropriationReplacementDeferralPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-6 sm:p-10">
      <header>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← ダッシュボードに戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          収用等に伴い代替資産を取得した場合の課税繰延べの試算
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          譲渡価額(補償金・買取り代金)・取得費・譲渡費用・所有期間・代替資産の
          取得価額を入力すると、収用等に伴い代替資産を取得した場合の課税の
          繰延べの特例(措置法33条・33条の2、国税庁タックスアンサーNo.3552)を
          適用した場合の税額(申告分離課税)を試算できる。5,000万円特別控除
          (措置法33条の4。
          <Link href="/expropriation-sale-deduction" className="underline">
            /expropriation-sale-deduction
          </Link>
          )とは選択適用の関係にあり、実際に代替資産を取得している場合に、
          代替資産の取得価額に充当されなかった差金額に対応する部分についてのみ
          課税し、残りの譲渡益を将来に繰り延べることができる。取得費が不明、
          または譲渡価額の5%相当額を下回る場合は、概算取得費の特例(措置法31条の
          4、国税庁タックスアンサーNo.3258)により譲渡価額の5%相当額を取得費と
          することを選択できる。
        </p>
      </header>

      <ExpropriationReplacementDeferralForm />

      <p className="rounded-md border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        本ツールは、課税繰延べの特例の適用要件(代替資産の取得期限内の取得・
        代替資産の資産区分要件等)の判定は行わない(deferralEligibleとして
        ユーザー自身が確認する)。代替資産を将来譲渡する際に引き継がれる取得
        価額(圧縮記帳後の帳簿価額)は参考値として算出するが、DBへの登録・
        翌年以降への自動繰越は行わない。実際の申告内容は国税庁タックスアンサー
        No.3552や税理士等の専門家に確認すること。
      </p>
    </div>
  );
}
